import { Pinecone, type PineconeRecord } from '@pinecone-database/pinecone';

export class PineconeHelper {
    private pinecone: Pinecone;
    private indexName: string;

    constructor(apiKey: string, indexName: string) {
        this.pinecone = new Pinecone({ apiKey });
        this.indexName = indexName;
    }

    get index() {
        return this.pinecone.index(this.indexName);
    }

    /**
     * 安全的删除操作，兼容不同版本的API
     */
    async safeDelete(ids: string[]): Promise<void> {
        try {
            const index = this.index;

            // 尝试新的API方法
            if (typeof index.deleteMany === 'function') {
                await index.deleteMany(ids);
                return;
            }

            // 尝试旧的API方法
            if (typeof (index as any).delete === 'function') {
                await (index as any).delete({ ids });
                return;
            }

            // 如果都不行，尝试逐个删除
            for (const id of ids) {
                try {
                    await (index as any).delete1([id]);
                } catch (error) {
                    console.warn(`Failed to delete vector ${id}:`, error);
                }
            }

        } catch (error: any) {
            console.error('Delete operation failed:', error);
            throw new Error(`Failed to delete vectors: ${error.message}`);
        }
    }

    /**
     * 安全的批量更新操作
     */
    async safeUpdate(updates: Array<{ id: string; metadata: any }>): Promise<void> {
        try {
            const index = this.index;

            // 批量更新
            for (const update of updates) {
                await index.update({
                    id: update.id,
                    metadata: update.metadata
                });
            }

        } catch (error: any) {
            console.error('Update operation failed:', error);
            throw new Error(`Failed to update vectors: ${error.message}`);
        }
    }

    /**
     * 安全的批量插入操作
     */
    async safeUpsert(vectors: PineconeRecord[]): Promise<void> {
        try {
            const index = this.index;

            // 批量插入，每次最多100个
            const batchSize = 100;
            for (let i = 0; i < vectors.length; i += batchSize) {
                const batch = vectors.slice(i, i + batchSize);
                await index.upsert(batch);

                // 小延迟避免API限制
                if (i + batchSize < vectors.length) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }

        } catch (error: any) {
            console.error('Upsert operation failed:', error);
            throw new Error(`Failed to upsert vectors: ${error.message}`);
        }
    }

    /**
     * 获取索引统计信息
     */
    async getIndexStats() {
        try {
            const index = this.index;
            return await index.describeIndexStats();
        } catch (error: any) {
            console.error('Failed to get index stats:', error);
            return { totalVectorCount: 0 };
        }
    }

    /**
     * 检查索引是否存在
     */
    async indexExists(): Promise<boolean> {
        try {
            const indexList = await this.pinecone.listIndexes();
            return indexList.indexes?.some(idx => idx.name === this.indexName) || false;
        } catch (error) {
            console.error('Failed to check index existence:', error);
            return false;
        }
    }

    /**
     * 创建索引（如果不存在）
     */
    async createIndexIfNotExists(dimension: number = 1536) {
        try {
            const exists = await this.indexExists();
            if (!exists) {
                console.log(`Creating Pinecone index: ${this.indexName}`);
                await this.pinecone.createIndex({
                    name: this.indexName,
                    dimension: dimension,
                    metric: 'cosine',
                    spec: {
                        serverless: {
                            cloud: 'aws',
                            region: 'us-east-1'
                        }
                    }
                });

                // 等待索引创建完成
                console.log('Waiting for index to be ready...');
                await this.waitForIndexReady();
                console.log('Index is ready!');
            }
        } catch (error: any) {
            console.error('Failed to create index:', error);
            throw new Error(`Failed to create index: ${error.message}`);
        }
    }

    /**
     * 等待索引就绪
     */
    private async waitForIndexReady(maxWaitTime: number = 300000): Promise<void> {
        const startTime = Date.now();

        while (Date.now() - startTime < maxWaitTime) {
            try {
                const stats: any = await this.getIndexStats();
                if (stats.totalVectorCount !== undefined) {
                    return; // 索引已就绪
                }
            } catch (error) {
                // 继续等待
            }

            await new Promise(resolve => setTimeout(resolve, 5000)); // 等待5秒
        }

        throw new Error('Index creation timeout');
    }
}