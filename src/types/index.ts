// src/types/index.ts
// TypeScript类型定义文件

/**
 * Pinecone向量匹配结果类型
 */
export interface PineconeMatch {
    id?: string;
    score?: number;
    values?: number[];
    sparseValues?: {
        indices: number[];
        values: number[];
    };
    metadata?: Record<string, any>;
}

/**
 * Pinecone查询结果类型
 */
export interface PineconeQueryResult {
    matches?: PineconeMatch[];
    namespace?: string;
    usage?: {
        readUnits?: number;
    };
}

/**
 * 向量记录类型
 */
export interface VectorRecord {
    id: string;
    values?: number[];
    metadata?: VectorMetadata;
}

/**
 * 向量元数据类型
 */
export interface VectorMetadata {
    title?: string;
    content?: string;
    category?: string;
    source?: string;
    timestamp?: string;
    chunkIndex?: number;
    totalChunks?: number;
    wordCount?: number;
    [key: string]: any;
}

/**
 * 搜索结果类型
 */
export interface SearchResult {
    id: string;
    score: number;
    content: string;
    title: string;
    category: string;
    source: string;
    timestamp: string;
    chunkIndex: number;
    relevanceLevel: 'high' | 'medium' | 'low' | 'minimal';
}

/**
 * 文档索引选项
 */
export interface IndexingOptions {
    chunkSize?: number;
    chunkOverlap?: number;
    extractMetadata?: boolean;
    validateContent?: boolean;
}

/**
 * 文档处理结果
 */
export interface DocumentProcessingResult {
    success: boolean;
    content?: string;
    metadata?: Record<string, any>;
    errors?: string[];
}

/**
 * 索引结果类型
 */
export interface IndexingResult {
    success: boolean;
    chunksIndexed: number;
    title: string;
    category: string;
    source: string;
    metadata: Record<string, any>;
    errors: string[];
    warnings: string[];
}

/**
 * 知识库统计信息
 */
export interface KnowledgeBaseStats {
    totalVectors: number;
    categories: Record<string, number>;
    sources: Record<string, number>;
    timeDistribution: Record<string, number>;
    sizingInfo: {
        averageChunkSize: number;
        totalContent: number;
    };
    qualityMetrics: {
        documentsWithMetadata: number;
        averageWordsPerChunk: number;
    };
    lastUpdated: string;
}

/**
 * 清理结果类型
 */
export interface CleanupResult {
    duplicatesFound: number;
    duplicatesRemoved: number;
    emptyChunksFound: number;
    emptyChunksRemoved: number;
    timestampsUpdated: number;
    errors: string[];
}

/**
 * 管理操作类型
 */
export type ManagementOperation =
    | 'stats'
    | 'list'
    | 'update'
    | 'delete'
    | 'cleanup'
    | 'categories'
    | 'search-by-metadata';

/**
 * 管理操作结果
 */
export interface ManagementResult {
    operation: ManagementOperation;
    success: boolean;
    data: any;
    message: string;
    errors: string[];
}

/**
 * 文档信息类型
 */
export interface DocumentInfo {
    title: string;
    category: string;
    source: string;
    timestamp: string;
    totalChunks: number;
    wordCount: number;
    chunkIds: string[];
}

/**
 * 分类信息类型
 */
export interface CategoryInfo {
    name: string;
    count: number;
    estimatedTotal: number;
    lastUpdated: string | null;
    sources: string[];
}

/**
 * 工具执行参数基类
 */
export interface ToolParams {
    [key: string]: any;
}

/**
 * 搜索工具参数
 */
export interface SearchToolParams extends ToolParams {
    query: string;
    topK?: number;
    category?: string | null;
    threshold?: number;
}

/**
 * 索引工具参数
 */
export interface IndexToolParams extends ToolParams {
    content?: string;
    title: string;
    category?: string;
    source?: string;
    filePath?: string | null;
    options?: IndexingOptions;
}

/**
 * 管理工具参数
 */
export interface ManagementToolParams extends ToolParams {
    operation: ManagementOperation;
    options?: Record<string, any>;
}

/**
 * 批量索引参数
 */
export interface BatchIndexParams {
    documents: Array<{
        content?: string;
        title: string;
        category?: string;
        source?: string;
        filePath?: string;
    }>;
    options?: IndexingOptions;
}

/**
 * 批量索引结果
 */
export interface BatchIndexResult {
    total: number;
    successful: number;
    failed: number;
    results: IndexingResult[];
    errors: string[];
}

/**
 * 高级搜索参数
 */
export interface AdvancedSearchParams {
    query: string;
    searchStrategies?: string[];
    topK?: number;
    category?: string | null;
    dateRange?: {
        start: string;
        end: string;
    } | null;
}

/**
 * 高级搜索结果
 */
export interface AdvancedSearchResult {
    semantic: SearchResult[];
    keyword: SearchResult[];
    combined: SearchResult[];
    metadata: {
        strategiesUsed: string[];
        totalUnique: number;
        finalCount: number;
        searchComplexity: 'simple' | 'medium' | 'complex';
    };
}

/**
 * 查询复杂度类型
 */
export type QueryComplexity = 'simple' | 'medium' | 'complex';

/**
 * 相关性级别类型
 */
export type RelevanceLevel = 'high' | 'medium' | 'low' | 'minimal';

/**
 * 操作状态类型
 */
export type OperationStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * 错误类型定义
 */
export interface RAGError {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
}

/**
 * 性能指标类型
 */
export interface PerformanceMetrics {
    queryTime: number;
    indexingTime: number;
    searchAccuracy: number;
    throughput: number;
    cacheHitRate: number;
}

/**
 * 配置选项类型
 */
export interface RAGConfig {
    apiKeys: {
        openai: string;
        pinecone: string;
    };
    indexName: string;
    embedding: {
        model: string;
        dimension: number;
    };
    chunking: {
        defaultSize: number;
        defaultOverlap: number;
    };
    search: {
        defaultTopK: number;
        defaultThreshold: number;
    };
    cache: {
        enabled: boolean;
        ttl: number;
    };
}