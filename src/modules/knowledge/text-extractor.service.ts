import fs from 'fs/promises';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import { KnowledgeFileType } from '@prisma/client';
import { AppError } from '../../utils/errors';

const SUPPORTED_TYPES: Record<string, KnowledgeFileType> = {
  '.pdf': KnowledgeFileType.PDF,
  '.docx': KnowledgeFileType.DOCX,
  '.txt': KnowledgeFileType.TXT,
};

const MIME_TYPES: Record<KnowledgeFileType, string[]> = {
  [KnowledgeFileType.PDF]: ['application/pdf'],
  [KnowledgeFileType.DOCX]: [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  [KnowledgeFileType.TXT]: ['text/plain'],
};

export class TextExtractorService {
  resolveFileType(filename: string, mimeType: string): KnowledgeFileType {
    const extension = filename.toLowerCase().match(/\.[^.]+$/)?.[0] ?? '';

    if (SUPPORTED_TYPES[extension]) {
      return SUPPORTED_TYPES[extension];
    }

    for (const [fileType, mimeTypes] of Object.entries(MIME_TYPES)) {
      if (mimeTypes.includes(mimeType)) {
        return fileType as KnowledgeFileType;
      }
    }

    throw new AppError(400, 'Unsupported file type. Allowed: PDF, DOCX, TXT');
  }

  async extractText(filePath: string, fileType: KnowledgeFileType): Promise<string> {
    switch (fileType) {
      case KnowledgeFileType.PDF:
        return this.extractPdf(filePath);
      case KnowledgeFileType.DOCX:
        return this.extractDocx(filePath);
      case KnowledgeFileType.TXT:
        return this.extractTxt(filePath);
      default:
        throw new AppError(400, 'Unsupported file type');
    }
  }

  private async extractPdf(filePath: string): Promise<string> {
    const buffer = await fs.readFile(filePath);
    const parser = new PDFParse({ data: buffer });

    try {
      const result = await parser.getText();
      return result.text.trim();
    } finally {
      await parser.destroy();
    }
  }

  private async extractDocx(filePath: string): Promise<string> {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value.trim();
  }

  private async extractTxt(filePath: string): Promise<string> {
    const content = await fs.readFile(filePath, 'utf-8');
    return content.trim();
  }
}

export const textExtractorService = new TextExtractorService();
