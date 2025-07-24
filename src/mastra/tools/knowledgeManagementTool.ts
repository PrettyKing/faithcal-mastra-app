// src/mastra/tools/knowledgeManagementTool.ts
import { PineconeHelper } from '../../utils/pineconeHelper';

/**
 * Tool for managing and organizing the knowledge base
 */
export class KnowledgeManagementTool {
    static description = 'Manages and organizes the knowledge base including updates, deletions, and analytics';

    private static pineconeHelper = new PineconeHelper(
        process.env.PINECONE_API_KEY!,
        process.env.PINECONE_INDEX_NAME || 'mastra-knowledge-base'
    );
    constructor() {
        // Initialize any required resources or configurations
    }
    /**
     * Executes knowledge management operations
     * @param {Object} params - Parameters for knowledge management
     * @param {string} params.operation - The operation to perform
     * @param {Object} params.options - Operation-specific options
     * @returns {Object} - Operation results
     */
    async execute({
        operation,
        options = {}
    }: {
        operation: 'stats' | 'list' | 'update' | 'delete' | 'cleanup' | 'categories' | 'search-by-metadata';
        options?: any;
    }) {
        const result = {
            operation: operation,
            success: false,
            data: null,
            message: '',
            errors: []
        } as any;

        try {
            switch (operation) {
                case 'stats':
                    result.data = await KnowledgeManagementTool.getKnowledgeBaseStats(options);
                    result.success = true;
                    result.message = 'Knowledge base statistics retrieved successfully';
                    break;

                case 'list':
                    result.data = await KnowledgeManagementTool.listDocuments(options);
                    result.success = true;
                    result.message = `Found ${result.data.documents.length} documents`;
                    break;

                case 'update':
                    result.data = await KnowledgeManagementTool.updateDocument(options);
                    result.success = true;
                    result.message = 'Document updated successfully';
                    break;

                case 'delete':
                    result.data = await KnowledgeManagementTool.deleteDocument(options);
                    result.success = true;
                    result.message = 'Document deleted successfully';
                    break;

                case 'cleanup':
                    result.data = await KnowledgeManagementTool.cleanupKnowledgeBase(options);
                    result.success = true;
                    result.message = 'Knowledge base cleanup completed';
                    break;

                case 'categories':
                    result.data = await KnowledgeManagementTool.getCategories(options);
                    result.success = true;
                    result.message = 'Categories retrieved successfully';
                    break;

                case 'search-by-metadata':
                    result.data = await KnowledgeManagementTool.searchByMetadata(options);
                    result.success = true;
                    result.message = `Found ${result.data.results.length} matching documents`;
                    break;

                default:
                    result.errors.push(`Unknown operation: ${operation}`);
                    result.message = 'Invalid operation specified';
                    return result;
            }

            return result;

        } catch (error: any) {
            result.errors.push(`Operation failed: ${error.message}`);
            result.message = `Failed to execute ${operation}`;
            console.error(`Knowledge management error (${operation}):`, error);
            return result;
        }
    }

    /**
     * Gets comprehensive statistics about the knowledge base
     */
    private static async getKnowledgeBaseStats(options: any = {}) {
        const stats = {
            totalVectors: 0,
            categories: {},
            sources: {},
            timeDistribution: {},
            sizingInfo: {
                averageChunkSize: 0,
                totalContent: 0
            },
            qualityMetrics: {
                documentsWithMetadata: 0,
                averageWordsPerChunk: 0
            },
            lastUpdated: new Date().toISOString()
        } as any;

        // Get index statistics
        const indexStats: any = await KnowledgeManagementTool.pineconeHelper.getIndexStats();
        stats.totalVectors = indexStats.totalVectorCount || 0;

        if (stats.totalVectors === 0) {
            return stats;
        }

        // Sample vectors to analyze distribution
        const sampleSize = Math.min(1000, stats.totalVectors);
        const sampleResults = await this.sampleVectors(sampleSize);

        // Analyze categories
        sampleResults.forEach((vector: any) => {
            const category = vector.metadata?.category || 'Unknown';
            stats.categories[category] = (stats.categories[category] || 0) + 1;

            const source = vector.metadata?.source || 'Unknown';
            stats.sources[source] = (stats.sources[source] || 0) + 1;

            // Time distribution
            if (vector.metadata?.timestamp) {
                const date = new Date(vector.metadata.timestamp);
                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                stats.timeDistribution[monthKey] = (stats.timeDistribution[monthKey] || 0) + 1;
            }

            // Content analysis
            if (vector.metadata?.content) {
                stats.sizingInfo.totalContent += vector.metadata.content.length;
                const wordCount = vector.metadata.wordCount || vector.metadata.content.split(/\s+/).length;
                stats.qualityMetrics.averageWordsPerChunk += wordCount;
            }

            if (vector.metadata && Object.keys(vector.metadata).length > 3) {
                stats.qualityMetrics.documentsWithMetadata++;
            }
        });

        // Calculate averages
        if (sampleResults.length > 0) {
            stats.sizingInfo.averageChunkSize = Math.round(stats.sizingInfo.totalContent / sampleResults.length);
            stats.qualityMetrics.averageWordsPerChunk = Math.round(stats.qualityMetrics.averageWordsPerChunk / sampleResults.length);
        }

        // Extrapolate to full dataset
        const scaleFactor = stats.totalVectors / sampleResults.length;
        Object.keys(stats.categories).forEach(key => {
            stats.categories[key] = Math.round(stats.categories[key] * scaleFactor);
        });

        Object.keys(stats.sources).forEach(key => {
            stats.sources[key] = Math.round(stats.sources[key] * scaleFactor);
        });

        return stats;
    }

    /**
     * Lists documents in the knowledge base with pagination
     */
    private static async listDocuments(options: {
        limit?: number;
        category?: string;
        source?: string;
        sortBy?: 'timestamp' | 'title' | 'category';
        sortOrder?: 'asc' | 'desc';
    } = {}) {
        const {
            limit = 50,
            category = null,
            source = null,
            sortBy = 'timestamp',
            sortOrder = 'desc'
        } = options;

        // Build filter
        const filter: any = {};
        if (category) filter.category = { $eq: category };
        if (source) filter.source = { $eq: source };

        // Query with filter
        const queryResult = await KnowledgeManagementTool.pineconeHelper.index.query({
            vector: new Array(1536).fill(0), // Dummy vector for metadata-only search
            topK: Math.min(limit, 10000),
            includeMetadata: true,
            includeValues: false,
            filter: Object.keys(filter).length > 0 ? filter : undefined
        });

        // Group by document title to avoid duplicates
        const documentsMap = new Map();

        (queryResult.matches || []).forEach(match => {
            const title = match.metadata?.title || 'Unknown';

            if (!documentsMap.has(title)) {
                documentsMap.set(title, {
                    title: title,
                    category: match.metadata?.category || 'Unknown',
                    source: match.metadata?.source || 'Unknown',
                    timestamp: match.metadata?.timestamp || 'Unknown',
                    totalChunks: match.metadata?.totalChunks || 1,
                    wordCount: match.metadata?.wordCount || 0,
                    chunkIds: [match.id]
                });
            } else {
                const doc = documentsMap.get(title);
                doc.chunkIds.push(match.id);
                doc.wordCount += (match.metadata?.wordCount || 0);
            }
        });

        // Convert to array and sort
        let documents = Array.from(documentsMap.values());

        documents.sort((a, b) => {
            let comparison = 0;

            switch (sortBy) {
                case 'title':
                    comparison = a.title.localeCompare(b.title);
                    break;
                case 'category':
                    comparison = a.category.localeCompare(b.category);
                    break;
                case 'timestamp':
                    const dateA = new Date(a.timestamp);
                    const dateB = new Date(b.timestamp);
                    comparison = dateA.getTime() - dateB.getTime();
                    break;
            }

            return sortOrder === 'desc' ? -comparison : comparison;
        });

        return {
            documents: documents.slice(0, limit),
            totalFound: documents.length,
            hasMore: documents.length > limit,
            filters: { category, source },
            sorting: { sortBy, sortOrder }
        };
    }

    /**
     * Updates a document in the knowledge base
     */
    private static async updateDocument(options: {
        title: string;
        newContent?: string;
        newMetadata?: any;
        operation?: 'replace' | 'append' | 'metadata-only';
    }) {
        const { title, newContent, newMetadata, operation = 'replace' } = options;

        // First find all chunks for this document
        const existingChunks = await KnowledgeManagementTool.pineconeHelper.index.query({
            vector: new Array(1536).fill(0),
            topK: 10000,
            includeMetadata: true,
            filter: { title: { $eq: title } }
        });

        if (!existingChunks.matches || existingChunks.matches.length === 0) {
            throw new Error(`Document "${title}" not found`);
        }

        const chunkIds = existingChunks.matches.map(match => match.id!);

        if (operation === 'metadata-only' && newMetadata) {
            // Update metadata only
            const updates = existingChunks.matches.map(match => ({
                id: match.id!,
                metadata: {
                    ...match.metadata,
                    ...newMetadata,
                    lastUpdated: new Date().toISOString()
                }
            }));

            await KnowledgeManagementTool.pineconeHelper.safeUpdate(updates);

            return {
                operation: 'metadata-only',
                chunksUpdated: updates.length,
                updatedFields: Object.keys(newMetadata)
            };
        }

        if (newContent) {
            // Delete old chunks
            await KnowledgeManagementTool.pineconeHelper.safeDelete(chunkIds);

            // Re-index with new content
            const DocumentIndexTool = await import('./documentIndexTool');
            const indexTool = new DocumentIndexTool.DocumentIndexTool();

            const existingMetadata = existingChunks.matches[0]?.metadata || {};
            const finalMetadata = { ...existingMetadata, ...newMetadata };

            const indexResult = await indexTool.execute({
                content: newContent,
                title: title,
                category: finalMetadata.category || 'General',
                source: finalMetadata.source || 'Updated',
                options: {
                    chunkSize: 1000,
                    chunkOverlap: 200,
                    extractMetadata: true
                }
            });

            return {
                operation: operation,
                oldChunksDeleted: chunkIds.length,
                newChunksCreated: indexResult.chunksIndexed,
                success: indexResult.success
            };
        }

        throw new Error('Either newContent or newMetadata must be provided');
    }

    /**
     * Deletes a document from the knowledge base
     */
    private static async deleteDocument(options: {
        title?: string;
        chunkIds?: string[];
        category?: string;
        confirmDeletion?: boolean;
    }) {
        const { title, chunkIds, category, confirmDeletion = false } = options;

        if (!confirmDeletion) {
            throw new Error('Deletion requires explicit confirmation. Set confirmDeletion: true');
        }

        let idsToDelete: string[] = [];

        if (chunkIds) {
            idsToDelete = chunkIds;
        } else if (title) {
            // Find all chunks for this document
            const chunks = await KnowledgeManagementTool.pineconeHelper.index.query({
                vector: new Array(1536).fill(0),
                topK: 10000,
                includeMetadata: true,
                filter: { title: { $eq: title } }
            });

            idsToDelete = chunks.matches?.map(match => match.id!) || [];
        } else if (category) {
            // Find all chunks in this category
            const chunks = await KnowledgeManagementTool.pineconeHelper.index.query({
                vector: new Array(1536).fill(0),
                topK: 10000,
                includeMetadata: true,
                filter: { category: { $eq: category } }
            });

            idsToDelete = chunks.matches?.map(match => match.id!) || [];
        } else {
            throw new Error('Either title, chunkIds, or category must be specified');
        }

        if (idsToDelete.length === 0) {
            return {
                deletedCount: 0,
                message: 'No matching documents found to delete'
            };
        }

        // Delete using the helper
        await KnowledgeManagementTool.pineconeHelper.safeDelete(idsToDelete);

        return {
            deletedCount: idsToDelete.length,
            deletedItems: title ? `document "${title}"` : category ? `category "${category}"` : 'specified chunks',
            message: `Successfully deleted ${idsToDelete.length} chunks`
        };
    }

    /**
     * Cleans up the knowledge base by removing duplicates and orphaned data
     */
    private static async cleanupKnowledgeBase(options: {
        removeDuplicates?: boolean;
        removeEmptyChunks?: boolean;
        updateTimestamps?: boolean;
        dryRun?: boolean;
    } = {}) {
        const {
            removeDuplicates = true,
            removeEmptyChunks = true,
            updateTimestamps = false,
            dryRun = false
        } = options;

        const cleanup = {
            duplicatesFound: 0,
            duplicatesRemoved: 0,
            emptyChunksFound: 0,
            emptyChunksRemoved: 0,
            timestampsUpdated: 0,
            errors: []
        } as any;

        try {
            // Sample the knowledge base for analysis
            const sampleSize = 5000;
            const vectors = await this.sampleVectors(sampleSize);

            if (removeEmptyChunks) {
                const emptyChunks = vectors.filter((v: any) =>
                    !v.metadata?.content ||
                    v.metadata.content.trim().length < 10
                );

                cleanup.emptyChunksFound = emptyChunks.length;

                if (!dryRun && emptyChunks.length > 0) {
                    const emptyIds = emptyChunks.map((v: any) => v.id!);
                    await KnowledgeManagementTool.pineconeHelper.safeDelete(emptyIds);
                    cleanup.emptyChunksRemoved = emptyIds.length;
                }
            }

            if (removeDuplicates) {
                const contentHashes = new Map<string, string>();
                const duplicates: string[] = [];

                vectors.forEach((vector: any) => {
                    if (vector.metadata?.content) {
                        const hash = this.hashContent(vector.metadata.content);

                        if (contentHashes.has(hash)) {
                            duplicates.push(vector.id!);
                        } else {
                            contentHashes.set(hash, vector.id!);
                        }
                    }
                });

                cleanup.duplicatesFound = duplicates.length;

                if (!dryRun && duplicates.length > 0) {
                    await KnowledgeManagementTool.pineconeHelper.safeDelete(duplicates);
                    cleanup.duplicatesRemoved = duplicates.length;
                }
            }

            if (updateTimestamps) {
                const vectorsWithoutTimestamp = vectors.filter((v: any) =>
                    !v.metadata?.timestamp ||
                    !this.isValidTimestamp(v.metadata.timestamp)
                );

                cleanup.timestampsUpdated = vectorsWithoutTimestamp.length;

                if (!dryRun && vectorsWithoutTimestamp.length > 0) {
                    const updates = vectorsWithoutTimestamp.map((vector: any) => ({
                        id: vector.id!,
                        metadata: {
                            ...vector.metadata,
                            timestamp: new Date().toISOString(),
                            cleanupUpdated: true
                        }
                    }));

                    // Update using the helper
                    await KnowledgeManagementTool.pineconeHelper.safeUpdate(updates);
                }
            }

            return cleanup;

        } catch (error: any) {
            cleanup.errors.push(`Cleanup failed: ${error.message}`);
            return cleanup;
        }
    }

    /**
     * Gets all categories in the knowledge base
     */
    private static async getCategories(options: { includeStats?: boolean } = {}) {
        const { includeStats = true } = options;

        const sampleSize = 2000;
        const vectors = await this.sampleVectors(sampleSize);

        const categoriesMap = new Map();

        vectors.forEach((vector: any) => {
            const category = vector.metadata?.category || 'Unknown';

            if (!categoriesMap.has(category)) {
                categoriesMap.set(category, {
                    name: category,
                    count: 0,
                    lastUpdated: null,
                    sources: new Set()
                });
            }

            const categoryData = categoriesMap.get(category);
            categoryData.count++;

            if (vector.metadata?.source) {
                categoryData.sources.add(vector.metadata.source);
            }

            if (vector.metadata?.timestamp) {
                const timestamp = new Date(vector.metadata.timestamp);
                if (!categoryData.lastUpdated || timestamp > categoryData.lastUpdated) {
                    categoryData.lastUpdated = timestamp;
                }
            }
        });

        // Convert to array and process
        const categories = Array.from(categoriesMap.values()).map(cat => ({
            ...cat,
            sources: Array.from(cat.sources),
            lastUpdated: cat.lastUpdated ? cat.lastUpdated.toISOString() : null
        }));

        // Extrapolate counts to full dataset
        const indexStats: any = await KnowledgeManagementTool.pineconeHelper.getIndexStats();
        const totalVectors = indexStats.totalVectorCount || 0;
        const scaleFactor = vectors.length > 0 ? totalVectors / vectors.length : 1;

        categories.forEach(cat => {
            cat.estimatedTotal = Math.round(cat.count * scaleFactor);
        });

        return {
            categories: categories.sort((a, b) => b.estimatedTotal - a.estimatedTotal),
            totalCategories: categories.length,
            sampledFrom: vectors.length,
            totalVectors: totalVectors
        };
    }

    /**
     * Searches by metadata filters
     */
    private static async searchByMetadata(options: {
        filters: any;
        limit?: number;
        includeContent?: boolean;
    }) {
        const { filters, limit = 100, includeContent = false } = options;

        const results = await KnowledgeManagementTool.pineconeHelper.index.query({
            vector: new Array(1536).fill(0),
            topK: Math.min(limit, 10000),
            includeMetadata: true,
            includeValues: false,
            filter: filters
        });

        const processedResults = (results.matches || []).map(match => ({
            id: match.id,
            score: match.score,
            metadata: match.metadata,
            content: includeContent ? match.metadata?.content : undefined
        }));

        return {
            results: processedResults,
            totalFound: processedResults.length,
            filters: filters,
            hasMore: processedResults.length >= limit
        };
    }

    /**
     * Samples vectors from the knowledge base for analysis
     */
    private static async sampleVectors(sampleSize: number) {
        // Create multiple random queries to get a diverse sample
        const samples: any[] = [];
        const queriesPerBatch = Math.ceil(sampleSize / 10);

        for (let i = 0; i < 10 && samples.length < sampleSize; i++) {
            const randomVector = Array.from({ length: 1536 }, () => Math.random() * 2 - 1);

            const result = await KnowledgeManagementTool.pineconeHelper.index.query({
                vector: randomVector,
                topK: queriesPerBatch,
                includeMetadata: true,
                includeValues: false
            });

            if (result.matches) {
                samples.push(...result.matches);
            }
        }

        // Remove duplicates and return sample
        const uniqueSamples = Array.from(
            new Map(samples.map(item => [item.id, item])).values()
        );

        return uniqueSamples.slice(0, sampleSize);
    }

    /**
     * Creates a hash of content for duplicate detection
     */
    private static hashContent(content: string): string {
        // Simple hash function for duplicate detection
        let hash = 0;
        const normalized = content.toLowerCase().replace(/\s+/g, ' ').trim();

        for (let i = 0; i < normalized.length; i++) {
            const char = normalized.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }

        return hash.toString();
    }

    /**
     * Validates if a timestamp is valid
     */
    private static isValidTimestamp(timestamp: string): boolean {
        try {
            const date = new Date(timestamp);
            return !isNaN(date.getTime()) && date.getFullYear() > 2000;
        } catch {
            return false;
        }
    }
}