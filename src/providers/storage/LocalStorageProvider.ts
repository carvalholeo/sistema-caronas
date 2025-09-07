import { IStorageProvider } from './IStorageProvider';
import fs from 'fs/promises';
import path from 'path';

export class LocalStorageProvider implements IStorageProvider {
  private uploadsDir = path.resolve(__dirname, '..', '..', '..', 'uploads');

  constructor() {
    // Garante que o diretório de uploads exista
    fs.mkdir(this.uploadsDir, { recursive: true });
  }

  public async saveFile(file: Express.Multer.File): Promise<string> {
    // O multer já salva o arquivo com um nome único.
    // Esta função apenas retorna a URL pública para acessá-lo.
    const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
    return `${baseUrl}/uploads/${file.filename}`;
  }

  public async deleteFile(fileUrl: string): Promise<void> {
    try {
      const filename = path.basename(fileUrl);
      const filePath = path.join(this.uploadsDir, filename);
      await fs.unlink(filePath);
    } catch (error: any) {
      // Ignora erros se o arquivo não existir
      if (error.code !== 'ENOENT') {
        console.error('Erro ao deletar arquivo local:', error);
      }
    }
  }
}
