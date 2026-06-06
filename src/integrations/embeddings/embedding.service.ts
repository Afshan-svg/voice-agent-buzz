import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { toVectorLiteral } from '../../utils/vector';

interface EmbeddingResponse {
  data: Array<{
    embedding: number[];
    index: number;
  }>;
}

export class EmbeddingService {
  private readonly apiUrl = 'https://api.openai.com/v1/embeddings';

  async embedTexts(texts: string[]): Promise<number[][]> {
    if (!env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    if (texts.length === 0) {
      return [];
    }

    const sanitized = texts.map((text) => text.trim()).filter(Boolean);

    if (sanitized.length === 0) {
      return [];
    }

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.OPENAI_EMBEDDING_MODEL,
        input: sanitized,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error('OpenAI embedding request failed', {
        status: response.status,
        body: errorBody,
      });
      throw new Error('Failed to generate embeddings');
    }

    const payload = (await response.json()) as EmbeddingResponse;

    return payload.data
      .sort((a, b) => a.index - b.index)
      .map((item) => item.embedding);
  }

  async embedText(text: string): Promise<number[]> {
    const [embedding] = await this.embedTexts([text]);
    return embedding;
  }

  formatForPgVector(embedding: number[]): string {
    return toVectorLiteral(embedding);
  }
}

export const embeddingService = new EmbeddingService();
