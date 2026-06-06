import { KnowledgeFile, Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { getSkip } from '../utils/pagination';

export interface KnowledgeSearchResult {
  chunkId: string;
  content: string;
  fileId: string;
  fileName: string;
  similarity: number;
}

export class KnowledgeRepository {
  async createFile(data: Prisma.KnowledgeFileCreateInput): Promise<KnowledgeFile> {
    return prisma.knowledgeFile.create({ data });
  }

  async findFileById(id: string): Promise<
    | (KnowledgeFile & {
        _count: { chunks: number };
      })
    | null
  > {
    return prisma.knowledgeFile.findUnique({
      where: { id },
      include: {
        _count: {
          select: { chunks: true },
        },
      },
    });
  }

  async findManyFiles(page: number, limit: number): Promise<{
    files: Array<KnowledgeFile & { _count: { chunks: number } }>;
    total: number;
  }> {
    const skip = getSkip(page, limit);

    const [files, total] = await Promise.all([
      prisma.knowledgeFile.findMany({
        include: {
          _count: {
            select: { chunks: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.knowledgeFile.count(),
    ]);

    return { files, total };
  }

  async deleteFile(id: string): Promise<KnowledgeFile> {
    return prisma.knowledgeFile.delete({ where: { id } });
  }

  async createChunk(data: {
    fileId: string;
    content: string;
    chunkIndex: number;
    metadata?: Prisma.InputJsonValue;
  }): Promise<string> {
    const chunk = await prisma.knowledgeChunk.create({
      data: {
        fileId: data.fileId,
        content: data.content,
        chunkIndex: data.chunkIndex,
        metadata: data.metadata,
      },
      select: { id: true },
    });

    return chunk.id;
  }

  async updateChunkEmbedding(chunkId: string, embeddingLiteral: string): Promise<void> {
    await prisma.$executeRaw`
      UPDATE knowledge_chunks
      SET embedding = ${embeddingLiteral}::vector
      WHERE id = ${chunkId}::uuid
    `;
  }

  async searchSimilar(
    embeddingLiteral: string,
    limit: number,
    minSimilarity: number
  ): Promise<KnowledgeSearchResult[]> {
    return prisma.$queryRaw<KnowledgeSearchResult[]>`
      SELECT
        kc.id AS "chunkId",
        kc.content,
        kc.file_id AS "fileId",
        kf.original_name AS "fileName",
        1 - (kc.embedding <=> ${embeddingLiteral}::vector) AS similarity
      FROM knowledge_chunks kc
      INNER JOIN knowledge_files kf ON kf.id = kc.file_id
      WHERE kc.embedding IS NOT NULL
        AND 1 - (kc.embedding <=> ${embeddingLiteral}::vector) >= ${minSimilarity}
      ORDER BY kc.embedding <=> ${embeddingLiteral}::vector
      LIMIT ${limit}
    `;
  }
}

export const knowledgeRepository = new KnowledgeRepository();
