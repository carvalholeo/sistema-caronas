import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { IStorageProvider } from './IStorageProvider';
import crypto from 'crypto';

export class S3StorageProvider implements IStorageProvider {
  private s3Client: S3Client;
  private bucketName: string;
  private region: string;

  constructor() {
    // Garante que todas as variáveis de ambiente necessárias estão definidas
    if (
      !process.env.AWS_REGION ||
      !process.env.AWS_ACCESS_KEY_ID ||
      !process.env.AWS_SECRET_ACCESS_KEY ||
      !process.env.S3_BUCKET_NAME
    ) {
      throw new Error(
        'As credenciais da AWS e o nome do bucket S3 devem ser definidos nas variáveis de ambiente.'
      );
    }

    this.region = process.env.AWS_REGION;
    this.bucketName = process.env.S3_BUCKET_NAME;
    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }

  public async saveFile(file: Express.Multer.File): Promise<string> {
    const hash = crypto.randomBytes(16).toString('hex');
    const fileKey = `${hash}-${file.originalname}`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: fileKey,
      Body: file.buffer, // Usa o buffer do arquivo em memória
      ContentType: file.mimetype,
      ACL: 'public-read', // Define o arquivo como publicamente acessível
    });

    try {
      await this.s3Client.send(command);
      // Retorna a URL pública do arquivo no S3
      const fileUrl = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${fileKey}`;
      return fileUrl;
    } catch (error) {
      console.error('Erro ao fazer upload do arquivo para o S3:', error);
      throw new Error('Falha ao salvar o arquivo no S3.');
    }
  }

  public async deleteFile(fileUrl: string): Promise<void> {
    try {
      const url = new URL(fileUrl);
      const fileKey = url.pathname.substring(1); // Remove a '/' inicial do caminho

      if (!fileKey) return; // Se não houver chave, não faz nada

      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey,
      });

      await this.s3Client.send(command);
    } catch (error) {
      console.error('Erro ao deletar o arquivo do S3:', error);
      // Não lançamos um erro aqui para não quebrar o fluxo caso o arquivo já tenha sido deletado.
    }
  }
}
