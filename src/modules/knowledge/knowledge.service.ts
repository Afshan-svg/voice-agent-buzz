import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../../config/env';
import { embeddingService } from '../../integrations/embeddings/embedding.service';
import {
  knowledgeRepository,
  KnowledgeSearchResult,
} from '../../repositories/knowledge.repository';
import { buildPaginatedResult, PaginatedResult } from '../../utils/pagination';
import { chunkText } from '../../utils/text-chunker';
import { AppError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { textExtractorService } from './text-extractor.service';

const EMBEDDING_BATCH_SIZE = 20;

export class KnowledgeService {
  private getUploadDir(): string {
    return path.resolve(env.UPLOAD_DIR, 'knowledge');
  }

  async ensureUploadDir(): Promise<void> {
    await fs.mkdir(this.getUploadDir(), { recursive: true });
  }

  async uploadFile(file: {
    originalname: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
  }) {
    if (!file) {
      throw new AppError(400, 'No file uploaded');
    }

    const fileType = textExtractorService.resolveFileType(
      file.originalname,
      file.mimetype
    );

    await this.ensureUploadDir();

    const storedFilename = `${uuidv4()}${path.extname(file.originalname).toLowerCase()}`;
    const storagePath = path.join(this.getUploadDir(), storedFilename);

    await fs.writeFile(storagePath, file.buffer);

    const text = await textExtractorService.extractText(storagePath, fileType);

    if (!text) {
      await fs.unlink(storagePath).catch(() => undefined);
      throw new AppError(400, 'Could not extract text from the uploaded file');
    }

    const chunks = chunkText(text, env.KNOWLEDGE_CHUNK_SIZE, env.KNOWLEDGE_CHUNK_OVERLAP);

    if (chunks.length === 0) {
      await fs.unlink(storagePath).catch(() => undefined);
      throw new AppError(400, 'Uploaded file contains no usable text');
    }

    const knowledgeFile = await knowledgeRepository.createFile({
      filename: storedFilename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      fileType,
      fileSize: file.size,
      storagePath,
    });

    try {
      await this.processChunks(knowledgeFile.id, chunks);
    } catch (error) {
      await knowledgeRepository.deleteFile(knowledgeFile.id).catch(() => undefined);
      await fs.unlink(storagePath).catch(() => undefined);
      throw error;
    }

    logger.info('Knowledge file processed', {
      fileId: knowledgeFile.id,
      originalName: file.originalname,
      chunks: chunks.length,
    });

    return {
      id: knowledgeFile.id,
      originalName: knowledgeFile.originalName,
      fileType: knowledgeFile.fileType,
      fileSize: knowledgeFile.fileSize,
      chunkCount: chunks.length,
      createdAt: knowledgeFile.createdAt.toISOString(),
    };
  }

  async listFiles(page: number, limit: number): Promise<PaginatedResult<{
    id: string;
    originalName: string;
    fileType: string;
    fileSize: number;
    chunkCount: number;
    createdAt: string;
    updatedAt: string;
  }>> {
    const { files, total } = await knowledgeRepository.findManyFiles(page, limit);

    return buildPaginatedResult(
      files.map((file) => ({
        id: file.id,
        originalName: file.originalName,
        fileType: file.fileType,
        fileSize: file.fileSize,
        chunkCount: file._count.chunks,
        createdAt: file.createdAt.toISOString(),
        updatedAt: file.updatedAt.toISOString(),
      })),
      total,
      page,
      limit
    );
  }

  async deleteFile(id: string): Promise<void> {
    const file = await knowledgeRepository.findFileById(id);

    if (!file) {
      throw new AppError(404, 'Knowledge file not found');
    }

    await knowledgeRepository.deleteFile(id);
    await fs.unlink(file.storagePath).catch(() => undefined);

    logger.info('Knowledge file deleted', { fileId: id, originalName: file.originalName });
  }

  async search(query: string, limit = env.KNOWLEDGE_SEARCH_LIMIT): Promise<KnowledgeSearchResult[]> {
    const normalizedQuery = query.trim();

    if (normalizedQuery.length < 3) {
      return [];
    }

    const embedding = await embeddingService.embedText(normalizedQuery);
    const embeddingLiteral = embeddingService.formatForPgVector(embedding);

    return knowledgeRepository.searchSimilar(
      embeddingLiteral,
      limit,
      env.KNOWLEDGE_MIN_SIMILARITY
    );
  }

  formatContextForPrompt(results: KnowledgeSearchResult[]): string {
    return results
      .map(
        (result, index) =>
          `[Source ${index + 1}: ${result.fileName} | relevance ${result.similarity.toFixed(2)}]\n${result.content}`
      )
      .join('\n\n');
  }

  private async processChunks(
    fileId: string,
    chunks: Array<{ content: string; index: number }>
  ): Promise<void> {
    for (let offset = 0; offset < chunks.length; offset += EMBEDDING_BATCH_SIZE) {
      const batch = chunks.slice(offset, offset + EMBEDDING_BATCH_SIZE);
      const chunkIds: string[] = [];

      for (const chunk of batch) {
        const chunkId = await knowledgeRepository.createChunk({
          fileId,
          content: chunk.content,
          chunkIndex: chunk.index,
          metadata: {
            chunkIndex: chunk.index,
          },
        });
        chunkIds.push(chunkId);
      }

      const embeddings = await embeddingService.embedTexts(batch.map((chunk) => chunk.content));

      await Promise.all(
        embeddings.map((embedding, index) =>
          knowledgeRepository.updateChunkEmbedding(
            chunkIds[index],
            embeddingService.formatForPgVector(embedding)
          )
        )
      );
    }
  }
}

export const knowledgeService = new KnowledgeService();
