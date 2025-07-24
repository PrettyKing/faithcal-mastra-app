// src/mastra/tools/documentIndexTool.ts
import { Pinecone } from '@pinecone-database/pinecone';
import * as pdf from 'pdf-parse';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Tool for indexing documents into the knowledge base
 */
export class DocumentIndexTool {
    static description = 'Indexes documents and content into the knowledge base with intelligent chunking and metadata extraction';

    private static pinecone = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY!
    });

    private static index = this.pinecone.index(process.env.PINECONE_INDEX_NAME || 'mastra-knowledge-base');

    /**
     * Indexes a document or text content
     * @param {Object} params - Parameters for document indexing
     * @param {string} params.content - The content to index (if not using file)
     * @param {string} params.title - Title of the document
     * @param {string} params.category - Category for organization
     * @param {string} params.source - Source of the document
     * @param {string} params.filePath - Path to file (alternative to content)
     * @param {Object} params.options - Additional indexing options
     * @returns {Object} - Indexing results
     */
    async execute({
        content = '',
        title,
        category = 'General',
        source = 'Manual Input',
        filePath = null,
        options = {
            chunkSize: 1000,
            chunkOverlap: 200,
            extractMetadata: true,
            validateContent: true
        }
    }: {
        content?: string;
        title: string;
        category?: string;
        source?: string;
        filePath?: string | null;
        options?: {
            chunkSize?: number;
            chunkOverlap?: number;
            extractMetadata?: boolean;
            validateContent?: boolean;
        };
    }) {
        const result = {
            success: false,
            chunksIndexed: 0,
            title: title,
            category: category,
            source: source,
            metadata: {},
            errors: [],
            warnings: []
        } as any;

        try {
            let documentContent = content;

            // Process file if filePath is provided
            if (filePath && !content) {
                const fileResult = await DocumentIndexTool.processFile(filePath);
                if (fileResult.success) {
                    documentContent = fileResult.content;
                    result.metadata.fileInfo = fileResult.metadata;
                } else {
                    result.errors.push(...fileResult.errors);
                    return result;
                }
            }

            // Validate content
            if (options.validateContent) {
                const validation = DocumentIndexTool.validateContent(documentContent, title);
                if (!validation.isValid) {
                    result.errors.push(...validation.errors);
                    result.warnings.push(...validation.warnings);

                    if (validation.errors.length > 0) {
                        return result;
                    }
                }
            }

            // Extract metadata if enabled
            if (options.extractMetadata) {
                result.metadata.extracted = DocumentIndexTool.extractMetadata(documentContent, title);
            }

            // Intelligent chunking
            const chunks = DocumentIndexTool.intelligentChunking(
                documentContent,
                options.chunkSize || 1000,
                options.chunkOverlap || 200
            );

            if (chunks.length === 0) {
                result.errors.push('No valid chunks created from content');
                return result;
            }

            // Generate embeddings for all chunks
            const embeddings = await DocumentIndexTool.generateEmbeddings(chunks);

            // Prepare vectors for indexing
            const vectors = chunks.map((chunk, index) => ({
                id: DocumentIndexTool.generateChunkId(title, index),
                values: embeddings[index],
                metadata: {
                    title: title,
                    category: category,
                    source: source,
                    content: chunk,
                    chunkIndex: index,
                    totalChunks: chunks.length,
                    timestamp: new Date().toISOString(),
                    wordCount: chunk.split(/\s+/).length,
                    ...result.metadata.extracted
                }
            }));

            // Index vectors in batches
            const batchSize = 100;
            for (let i = 0; i < vectors.length; i += batchSize) {
                const batch = vectors.slice(i, i + batchSize);
                await DocumentIndexTool.index.upsert(batch);
            }

            result.success = true;
            result.chunksIndexed = chunks.length;
            result.metadata.indexingStats = {
                totalVectors: vectors.length,
                averageChunkSize: Math.round(chunks.reduce((sum, chunk) => sum + chunk.length, 0) / chunks.length),
                batchesProcessed: Math.ceil(vectors.length / batchSize)
            };

            console.log(`✅ Successfully indexed "${title}" with ${chunks.length} chunks`);

            return result;

        } catch (error: any) {
            result.errors.push(`Indexing failed: ${error.message}`);
            console.error('Document indexing error:', error);
            return result;
        }
    }

    /**
     * Processes different file types
     */
    private static async processFile(filePath: string) {
        const result = {
            success: false,
            content: '',
            metadata: {},
            errors: []
        } as any;

        try {
            if (!fs.existsSync(filePath)) {
                result.errors.push(`File not found: ${filePath}`);
                return result;
            }

            const ext = path.extname(filePath).toLowerCase();
            const fileName = path.basename(filePath);
            const fileStats = fs.statSync(filePath);

            result.metadata = {
                fileName: fileName,
                fileSize: fileStats.size,
                fileType: ext,
                lastModified: fileStats.mtime.toISOString()
            };

            switch (ext) {
                case '.txt':
                case '.md':
                    result.content = fs.readFileSync(filePath, 'utf-8');
                    break;

                case '.pdf':
                    const pdfBuffer = fs.readFileSync(filePath);
                    const pdfData = await pdf(pdfBuffer);
                    result.content = pdfData.text;
                    result.metadata.pdfInfo = {
                        numPages: pdfData.numpages,
                        info: pdfData.info
                    };
                    break;

                case '.html':
                    const htmlContent = fs.readFileSync(filePath, 'utf-8');
                    const $ = cheerio.load(htmlContent);

                    // Extract text and preserve some structure
                    result.content = $('body').text() || $.text();

                    // Extract additional metadata
                    result.metadata.htmlInfo = {
                        title: $('title').text() || '',
                        metaDescription: $('meta[name="description"]').attr('content') || '',
                        headings: $('h1, h2, h3').map((_, el) => $(el).text()).get()
                    };
                    break;

                case '.json':
                    const jsonContent = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                    result.content = this.jsonToText(jsonContent);
                    result.metadata.jsonInfo = {
                        structure: this.analyzeJsonStructure(jsonContent)
                    };
                    break;

                default:
                    result.errors.push(`Unsupported file type: ${ext}`);
                    return result;
            }

            result.success = true;
            return result;

        } catch (error: any) {
            result.errors.push(`File processing error: ${error.message}`);
            return result;
        }
    }

    /**
     * Validates content before indexing
     */
    private static validateContent(content: string, title: string) {
        const result = {
            isValid: true,
            errors: [],
            warnings: []
        } as any;

        // Check for empty content
        if (!content || content.trim().length === 0) {
            result.errors.push('Content is empty or contains only whitespace');
            result.isValid = false;
        }

        // Check for minimum content length
        if (content.length < 50) {
            result.warnings.push('Content is very short, may not provide meaningful search results');
        }

        // Check for maximum content length
        if (content.length > 1000000) { // 1MB limit
            result.warnings.push('Content is very large, consider splitting into multiple documents');
        }

        // Check title
        if (!title || title.trim().length === 0) {
            result.errors.push('Title is required');
            result.isValid = false;
        }

        // Check for suspicious patterns
        const suspiciousPatterns = [
            /password/i,
            /api[_\s]*key/i,
            /secret/i,
            /token/i
        ];

        for (const pattern of suspiciousPatterns) {
            if (pattern.test(content)) {
                result.warnings.push(`Content may contain sensitive information (${pattern.source})`);
            }
        }

        return result;
    }

    /**
     * Extracts metadata from content
     */
    private static extractMetadata(content: string, title: string) {
        const metadata = {
            wordCount: 0,
            estimatedReadingTime: 0,
            language: 'en', // Default to English
            topics: [],
            entities: [],
            summary: ''
        } as any;

        // Basic statistics
        const words = content.split(/\s+/).filter(word => word.length > 0);
        metadata.wordCount = words.length;
        metadata.estimatedReadingTime = Math.ceil(words.length / 200); // 200 WPM average

        // Extract potential topics (simple keyword extraction)
        const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'among', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'shall']);

        const wordFreq = {};
        words.forEach(word => {
            const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
            if (cleanWord.length > 3 && !commonWords.has(cleanWord)) {
                wordFreq[cleanWord] = (wordFreq[cleanWord] || 0) + 1;
            }
        });

        // Get top keywords as topics
        metadata.topics = Object.entries(wordFreq)
            .sort(([, a], [, b]) => (b as number) - (a as number))
            .slice(0, 10)
            .map(([word]) => word);

        // Generate simple summary (first meaningful sentence)
        const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
        metadata.summary = sentences[0] ? sentences[0].trim().substring(0, 200) + '...' : title;

        return metadata;
    }

    /**
     * Intelligent chunking with semantic awareness
     */
    private static intelligentChunking(content: string, chunkSize: number = 1000, overlap: number = 200): string[] {
        const chunks: any[] = [];

        // First, try to split by paragraphs
        const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);

        let currentChunk = '';
        let currentSize = 0;

        for (const paragraph of paragraphs) {
            const paragraphSize = paragraph.length;

            // If paragraph alone exceeds chunk size, split it by sentences
            if (paragraphSize > chunkSize) {
                // Add current chunk if it exists
                if (currentChunk.trim()) {
                    chunks.push(currentChunk.trim());
                }

                // Split large paragraph by sentences
                const sentences = paragraph.split(/[.!?]+\s+/).filter(s => s.trim().length > 0);
                let sentenceChunk = '';

                for (const sentence of sentences) {
                    if ((sentenceChunk + sentence).length > chunkSize && sentenceChunk) {
                        chunks.push(sentenceChunk.trim());

                        // Add overlap from previous chunk
                        const words = sentenceChunk.split(' ');
                        const overlapWords = words.slice(-Math.floor(overlap / 10));
                        sentenceChunk = overlapWords.join(' ') + ' ' + sentence;
                    } else {
                        sentenceChunk += (sentenceChunk ? ' ' : '') + sentence;
                    }
                }

                if (sentenceChunk.trim()) {
                    chunks.push(sentenceChunk.trim());
                }

                currentChunk = '';
                currentSize = 0;
                continue;
            }

            // Check if adding this paragraph would exceed chunk size
            if (currentSize + paragraphSize > chunkSize && currentChunk) {
                chunks.push(currentChunk.trim());

                // Add overlap
                const words = currentChunk.split(' ');
                const overlapWords = words.slice(-Math.floor(overlap / 10));
                currentChunk = overlapWords.join(' ') + '\n\n' + paragraph;
                currentSize = currentChunk.length;
            } else {
                currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
                currentSize += paragraphSize + 2; // +2 for \n\n
            }
        }

        // Add final chunk
        if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
        }

        return chunks.filter(chunk => chunk.length > 0);
    }

    /**
     * Generates embeddings for text chunks
     */
    private static async generateEmbeddings(chunks: string[]): Promise<number[][]> {
        const embeddings: any[] = [];

        // Process in batches to avoid rate limits
        const batchSize = 10;
        for (let i = 0; i < chunks.length; i += batchSize) {
            const batch = chunks.slice(i, i + batchSize);
            const batchEmbeddings = await Promise.all(
                batch.map(chunk => this.createEmbedding(chunk))
            );
            embeddings.push(...batchEmbeddings);

            // Small delay to respect rate limits
            if (i + batchSize < chunks.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        return embeddings;
    }

    /**
     * Creates embedding for a single text chunk
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
     * Generates unique chunk ID
     */
    private static generateChunkId(title: string, chunkIndex: number): string {
        const timestamp = Date.now();
        const titleHash = title.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 20);
        return `${titleHash}-${chunkIndex}-${timestamp}`;
    }

    /**
     * Converts JSON object to searchable text
     */
    private static jsonToText(jsonObj: any, prefix = ''): string {
        let text = '';

        if (typeof jsonObj === 'object' && jsonObj !== null) {
            if (Array.isArray(jsonObj)) {
                jsonObj.forEach((item, index) => {
                    text += this.jsonToText(item, `${prefix}[${index}]`);
                });
            } else {
                for (const [key, value] of Object.entries(jsonObj)) {
                    const currentPath = prefix ? `${prefix}.${key}` : key;
                    if (typeof value === 'object') {
                        text += `${currentPath}: `;
                        text += this.jsonToText(value, currentPath);
                    } else {
                        text += `${currentPath}: ${value}\n`;
                    }
                }
            }
        } else {
            text += `${prefix}: ${jsonObj}\n`;
        }

        return text;
    }

    /**
     * Analyzes JSON structure for metadata
     */
    private static analyzeJsonStructure(jsonObj: any): any {
        const analysis = {
            type: Array.isArray(jsonObj) ? 'array' : typeof jsonObj,
            depth: 0,
            keys: [],
            arrayLength: 0
        } as any;

        if (Array.isArray(jsonObj)) {
            analysis.arrayLength = jsonObj.length;
            if (jsonObj.length > 0) {
                analysis.depth = 1 + this.getMaxDepth(jsonObj[0]);
            }
        } else if (typeof jsonObj === 'object' && jsonObj !== null) {
            analysis.keys = Object.keys(jsonObj);
            analysis.depth = this.getMaxDepth(jsonObj);
        }

        return analysis;
    }

    /**
     * Gets maximum depth of nested object
     */
    private static getMaxDepth(obj: any): number {
        if (typeof obj !== 'object' || obj === null) {
            return 0;
        }

        let maxDepth = 0;

        if (Array.isArray(obj)) {
            for (const item of obj) {
                maxDepth = Math.max(maxDepth, this.getMaxDepth(item));
            }
        } else {
            for (const value of Object.values(obj)) {
                maxDepth = Math.max(maxDepth, this.getMaxDepth(value));
            }
        }

        return 1 + maxDepth;
    }

    /**
     * Batch indexes multiple documents
     */
    async executeBatch({
        documents,
        options = {
            chunkSize: 1000,
            chunkOverlap: 200,
            validateContent: true,
            extractMetadata: true
        }
    }: {
        documents: Array<{
            content?: string;
            title: string;
            category?: string;
            source?: string;
            filePath?: string;
        }>;
        options?: {
            chunkSize?: number;
            chunkOverlap?: number;
            validateContent?: boolean;
            extractMetadata?: boolean;
        };
    }) {
        const results = {
            total: documents.length,
            successful: 0,
            failed: 0,
            results: [],
            errors: []
        } as any;

        console.log(`🔄 Starting batch indexing of ${documents.length} documents...`);

        for (let i = 0; i < documents.length; i++) {
            const doc = documents[i];
            console.log(`📄 Processing document ${i + 1}/${documents.length}: ${doc.title}`);

            try {
                const result = await this.execute({
                    content: doc.content,
                    title: doc.title,
                    category: doc.category || 'General',
                    source: doc.source || 'Batch Import',
                    filePath: doc.filePath,
                    options
                });

                results.results.push(result);

                if (result.success) {
                    results.successful++;
                    console.log(`✅ Successfully indexed: ${doc.title}`);
                } else {
                    results.failed++;
                    console.log(`❌ Failed to index: ${doc.title}`);
                    results.errors.push(...result.errors);
                }

            } catch (error: any) {
                results.failed++;
                results.errors.push(`Failed to process ${doc.title}: ${error.message}`);
                console.error(`❌ Error processing ${doc.title}:`, error);
            }

            // Small delay between documents to avoid overwhelming the system
            if (i < documents.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        console.log(`🎉 Batch indexing completed: ${results.successful} successful, ${results.failed} failed`);

        return results;
    }
}