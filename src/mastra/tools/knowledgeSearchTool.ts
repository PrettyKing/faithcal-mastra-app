import dotenv from 'dotenv';
import { Pinecone } from '@pinecone-database/pinecone';


dotenv.config({
    path: '../../.env',
    debug: true,
});
/**
 * Tool for searching the knowledge base using semantic similarity
 */
export class KnowledgeSearchTool {
    static description = 'Searches the knowledge base for relevant information using semantic similarity';

    private static pinecone = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY!
    });

    private static index = this.pinecone.index(process.env.PINECONE_INDEX_NAME || 'mastra-knowledge-base');

    constructor() {
        if (!process.env.PINECONE_API_KEY) {
            throw new Error('Pinecone API key is not set in environment variables');
        }
        if (!process.env.PINECONE_INDEX_NAME) {
            throw new Error('Pinecone index name is not set in environment variables');
        }
    }

    /**
     * Executes knowledge base search
     * @param {Object} params - Parameters for knowledge search
     * @param {string} params.query - The search query
     * @param {number} params.topK - Number of results to return (default: 5)
     * @param {string} params.category - Optional category filter
     * @param {number} params.threshold - Minimum similarity threshold (default: 0.7)
     * @returns {Object} - Search results
     */
    async execute({
        query,
        topK = 5,
        category = null,
        threshold = 0.7
    }: {
        query: string;
        topK?: number;
        category?: string | null;
        threshold?: number;
    }) {
        const result = {
            results: [],
            totalFound: 0,
            query: query,
            searchParams: { topK, category, threshold }
        } as any;

        try {
            // Generate embedding for the query
            const queryEmbedding = await KnowledgeSearchTool.createEmbedding(query);

            // Prepare search parameters
            const searchParams: any = {
                vector: queryEmbedding,
                topK: Math.min(topK, 20), // Limit to 20 max
                includeMetadata: true,
                includeValues: false
            };

            // Add category filter if specified
            if (category) {
                searchParams.filter = {
                    category: { $eq: category }
                };
            }

            // Execute search
            const searchResults = await KnowledgeSearchTool.index.query(searchParams);

            // Process and filter results
            const filteredResults = (searchResults.matches || [])
                .filter(match => match.score! >= threshold)
                .map(match => ({
                    id: match.id,
                    score: match.score,
                    content: match.metadata?.content || '',
                    title: match.metadata?.title || 'Unknown',
                    category: match.metadata?.category || 'General',
                    source: match.metadata?.source || 'Unknown',
                    timestamp: match.metadata?.timestamp || 'Unknown',
                    chunkIndex: match.metadata?.chunkIndex || 0,
                    relevanceLevel: KnowledgeSearchTool.getRelevanceLevel(match.score!)
                }));

            result.results = filteredResults;
            result.totalFound = filteredResults.length;

            // Add search insights
            if (filteredResults.length === 0) {
                result.suggestions = [
                    'Try using different keywords or synonyms',
                    'Consider broadening your search terms',
                    'Check if the information exists in the knowledge base'
                ];
            } else {
                result.insights = {
                    highRelevance: filteredResults.filter((r: any) => r.score >= 0.9).length,
                    mediumRelevance: filteredResults.filter((r: any) => r.score >= 0.8 && r.score < 0.9).length,
                    lowRelevance: filteredResults.filter((r: any) => r.score < 0.8).length,
                    categories: [...new Set(filteredResults.map(r => r.category))]
                };
            }

            return result;

        } catch (error: any) {
            return {
                results: [],
                totalFound: 0,
                error: {
                    message: `Knowledge search failed: ${error.message}`,
                    type: 'search_error'
                },
                suggestions: [
                    'Check if the knowledge base is properly initialized',
                    'Verify API keys and connection settings',
                    'Try a simpler search query'
                ]
            };
        }
    }

    /**
     * Creates embedding for text using OpenAI
     */
    private static async createEmbedding(text: string): Promise<number[]> {
        try {
            const response = await fetch('https://api.openai.com/v1/embeddings', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    input: text,
                    model: 'text-embedding-3-small'
                })
            });

            if (!response.ok) {
                throw new Error(`OpenAI API error: ${response.statusText}`);
            }

            const data = await response.json();
            return data.data[0].embedding;

        } catch (error: any) {
            console.error('Error creating embedding:', error);
            throw new Error(`Failed to create embedding: ${error.message}`);
        }
    }

    /**
     * Determines relevance level based on similarity score
     */
    private static getRelevanceLevel(score: number): string {
        if (score >= 0.9) return 'high';
        if (score >= 0.8) return 'medium';
        if (score >= 0.7) return 'low';
        return 'minimal';
    }

    /**
     * Performs advanced search with multiple strategies
     */
    async executeAdvanced({
        query,
        searchStrategies = ['semantic', 'keyword'],
        topK = 10,
        category = null,
        dateRange = null
    }: {
        query: string;
        searchStrategies?: string[];
        topK?: number;
        category?: string | null;
        dateRange?: { start: string; end: string } | null;
    }) {
        const results = {
            semantic: [],
            keyword: [],
            combined: [],
            metadata: {}
        } as any;

        try {
            // Semantic search
            if (searchStrategies.includes('semantic')) {
                const semanticResults = await this.execute({ query, topK, category });
                results.semantic = semanticResults.results;
            }

            // Keyword search (simulated with metadata filtering)
            if (searchStrategies.includes('keyword')) {
                const keywords = this.extractKeywords(query);
                const keywordResults = await this.searchByKeywords(keywords, topK, category);
                results.keyword = keywordResults;
            }

            // Combine and deduplicate results
            const allResults = [...results.semantic, ...results.keyword];
            const uniqueResults = this.deduplicateResults(allResults);

            // Re-rank combined results
            results.combined = this.rerankResults(uniqueResults, query).slice(0, topK);

            results.metadata = {
                strategiesUsed: searchStrategies,
                totalUnique: uniqueResults.length,
                finalCount: results.combined.length,
                searchComplexity: this.analyzeQueryComplexity(query)
            };

            return results;

        } catch (error: any) {
            throw new Error(`Advanced search failed: ${error.message}`);
        }
    }

    /**
     * Extracts keywords from query
     */
    private extractKeywords(query: string): string[] {
        // Simple keyword extraction (in production, use NLP libraries)
        return query
            .toLowerCase()
            .split(/\s+/)
            .filter(word => word.length > 2)
            .filter(word => !['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'shall'].includes(word));
    }

    /**
     * Searches by keywords using metadata
     */
    private async searchByKeywords(keywords: string[], topK: number, category: string | null) {
        // This is a simplified implementation
        // In production, you'd implement proper full-text search
        const keywordQuery = keywords.join(' ');
        return this.execute({ query: keywordQuery, topK, category });
    }

    /**
     * Removes duplicate results based on content similarity
     */
    private deduplicateResults(results: any[]): any[] {
        const unique: any[] = [];
        const seen = new Set();

        for (const result of results) {
            const contentHash = this.hashContent(result.content);
            if (!seen.has(contentHash)) {
                seen.add(contentHash);
                unique.push(result);
            }
        }

        return unique;
    }

    /**
     * Creates a simple hash of content for deduplication
     */
    private hashContent(content: string): string {
        return content.toLowerCase().replace(/\s+/g, ' ').trim().substring(0, 100);
    }

    /**
     * Re-ranks results based on multiple factors
     */
    private rerankResults(results: any[], originalQuery: string): any[] {
        return results
            .map(result => ({
                ...result,
                rerankScore: this.calculateRerankScore(result, originalQuery)
            }))
            .sort((a, b) => b.rerankScore - a.rerankScore);
    }

    /**
     * Calculates rerank score based on multiple factors
     */
    private calculateRerankScore(result: any, query: string): number {
        let score = result.score || 0;

        // Boost for exact keyword matches
        const queryLower = query.toLowerCase();
        const contentLower = result.content.toLowerCase();
        const exactMatches = (queryLower.match(/\b\w+\b/g) || [])
            .filter(word => contentLower.includes(word)).length;

        score += exactMatches * 0.1;

        // Boost for recent content
        if (result.timestamp) {
            const daysSinceUpdate = this.getDaysSince(result.timestamp);
            if (daysSinceUpdate < 30) score += 0.05;
        }

        // Boost for high-quality sources
        if (result.source && result.source.includes('official')) {
            score += 0.05;
        }

        return Math.min(score, 1.0);
    }

    /**
     * Gets days since a timestamp
     */
    private getDaysSince(timestamp: string): number {
        try {
            const date = new Date(timestamp);
            const now = new Date();
            return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
        } catch {
            return Infinity;
        }
    }

    /**
     * Analyzes query complexity
     */
    private analyzeQueryComplexity(query: string): 'simple' | 'medium' | 'complex' {
        const wordCount = query.split(/\s+/).length;
        const hasQuestions = /\?/.test(query);
        const hasComparisons = /\b(vs|versus|compare|difference|better|worse)\b/i.test(query);
        const hasMultipleConcepts = /\band\b|\bor\b/i.test(query);

        if (wordCount > 10 || hasComparisons || hasMultipleConcepts) {
            return 'complex';
        } else if (wordCount > 5 || hasQuestions) {
            return 'medium';
        } else {
            return 'simple';
        }
    }
}