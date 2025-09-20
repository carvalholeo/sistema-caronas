// tests/unit/providers/storage/S3StorageProvider.test.ts

import { S3Client } from '@aws-sdk/client-s3';
import { S3StorageProvider } from '../../../../src/providers/storage/S3StorageProvider';
import logger from '../../../../src/utils/logger';
import { randomUUID } from 'crypto';

// Mock dependências
jest.mock('../../../../src/utils/logger');
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'), // Mantém outras funções de crypto
  randomUUID: jest.fn(),
}));


// --- CORREÇÃO PRINCIPAL: SIMPLIFICANDO O MOCK DO S3 ---

// 1. Criamos uma única função mock para o método 'send' que será compartilhada.
const mockSend = jest.fn();

// 2. Mockamos o S3Client para que qualquer instância criada use nossa função 'mockSend'.
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: mockSend,
  })),
  // Mockamos os comandos para que o teste não falhe ao tentar instanciá-los
  PutObjectCommand: jest.fn().mockImplementation(input => ({ input })),
  DeleteObjectCommand: jest.fn().mockImplementation(input => ({ input })),
}));

const mockedS3Client = S3Client as jest.MockedClass<typeof S3Client>;
const mockedLogger = logger as jest.Mocked<typeof logger>;
const mockedRandomUUID = randomUUID as jest.Mock;


describe('S3StorageProvider', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Limpamos o estado dos mocks antes de cada teste
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  const setValidEnv = () => {
    process.env.AWS_REGION = 'us-east-1';
    process.env.AWS_ACCESS_KEY_ID = 'test-key';
    process.env.AWS_SECRET_ACCESS_KEY = 'test-secret';
    process.env.S3_BUCKET_NAME = 'test-bucket';
  };

  describe('Constructor', () => {
    it('should throw an error if environment variables are not set', () => {
      expect(() => new S3StorageProvider()).toThrow('As credenciais da AWS e o nome do bucket S3 devem ser definidos');
    });

    it('should create an S3Client with correct credentials', () => {
      setValidEnv();
      new S3StorageProvider();
      expect(mockedS3Client).toHaveBeenCalledWith({
        region: 'us-east-1',
        credentials: {
          accessKeyId: 'test-key',
          secretAccessKey: 'test-secret',
        },
      });
    });
  });

  describe('saveFile', () => {
    it('should upload a file and return its public URL', async () => {
      setValidEnv();
      const provider = new S3StorageProvider();
      // Agora configuramos o comportamento do 'mockSend' diretamente
      mockSend.mockResolvedValue({});

      const mockFile = {
        originalname: 'test.jpg',
        buffer: Buffer.from('test-data'),
        mimetype: 'image/jpeg',
      } as Express.Multer.File;

      mockedRandomUUID.mockReturnValue('mock-hash');

      const fileUrl = await provider.saveFile(mockFile);

      expect(mockSend).toHaveBeenCalledTimes(1);
      const command = mockSend.mock.calls[0][0];
      expect(command.input.Bucket).toBe('test-bucket');
      expect(command.input.Key).toBe('mock-hash-test.jpg');
      expect(command.input.Body).toBe(mockFile.buffer);
      expect(fileUrl).toBe('https://test-bucket.s3.us-east-1.amazonaws.com/mock-hash-test.jpg');
    });

    it('should throw an error if S3 upload fails', async () => {
      setValidEnv();
      const provider = new S3StorageProvider();
      const uploadError = new Error('S3 Error');
      mockSend.mockRejectedValue(uploadError);

      const mockFile = { originalname: 'test.jpg', buffer: Buffer.from(''), mimetype: '' } as Express.Multer.File;

      await expect(provider.saveFile(mockFile)).rejects.toThrow('Falha ao salvar o arquivo no S3.');
      expect(mockedLogger.error).toHaveBeenCalledWith(expect.any(String), uploadError);
    });
  });

  describe('deleteFile', () => {
    it('should delete a file from S3 based on its URL', async () => {
      setValidEnv();
      const provider = new S3StorageProvider();
      mockSend.mockResolvedValue({});

      const fileKey = 'some-hash-test.jpg';
      const fileUrl = `https://test-bucket.s3.us-east-1.amazonaws.com/${fileKey}`;

      await provider.deleteFile(fileUrl);

      expect(mockSend).toHaveBeenCalledTimes(1);
      const command = mockSend.mock.calls[0][0];
      expect(command.input.Bucket).toBe('test-bucket');
      expect(command.input.Key).toBe(fileKey);
    });

    it('should not throw an error if an invalid URL is passed', async () => {
      setValidEnv();
      const provider = new S3StorageProvider();
      const deleteError = new TypeError('Invalid URL');
      mockSend.mockRejectedValue(deleteError);

      await expect(provider.deleteFile('some-url')).resolves.not.toThrow();
      // Pega o segundo argumento (o objeto de erro) da primeira chamada ao logger
      expect(mockedLogger.error).toHaveBeenCalledTimes(1);

      // @ts-ignore
      const loggedError = mockedLogger.error.mock.calls[0][1];

      // Verifica se o erro logado é do tipo correto
      expect((loggedError as unknown as TypeError)!.message).toBe('Invalid URL');
    });

    it('should not throw an error if deletion fails, only log', async () => {
      setValidEnv();
      const provider = new S3StorageProvider();
      const deleteError = new TypeError('S3 Delete Error');
      const fileKey = 'some-hash-test.jpg';
      const fileUrl = `https://test-bucket.s3.us-east-1.amazonaws.com/${fileKey}`;

      mockSend.mockRejectedValue(deleteError);

      await expect(provider.deleteFile(fileUrl)).resolves.not.toThrow();
      expect(mockedLogger.error).toHaveBeenCalledWith(expect.any(String), deleteError);
    });
  });
});
