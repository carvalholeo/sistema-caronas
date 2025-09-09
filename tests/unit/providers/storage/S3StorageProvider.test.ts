
import { S3Client } from '@aws-sdk/client-s3';
import { S3StorageProvider } from '../../../../src/providers/storage/S3StorageProvider';
import logger from '../../../../src/utils/logger';
import crypto from 'crypto';

// Mock dependencies
jest.mock('@aws-sdk/client-s3');
jest.mock('../../../src/utils/logger');

const mockedS3Client = S3Client as jest.MockedClass<typeof S3Client>;
const mockedLogger = logger as jest.Mocked<typeof logger>;

describe('S3StorageProvider', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    mockedS3Client.mockClear();
    (mockedS3Client.prototype.send as jest.Mock)?.mockClear();
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
      const sendMock = mockedS3Client.prototype.send as jest.Mock;
      sendMock.mockResolvedValue({});

      const mockFile = {
        originalname: 'test.jpg',
        buffer: Buffer.from('test-data'),
        mimetype: 'image/jpeg',
      } as Express.Multer.File;

      const mockHash = 'a1b2c3d4e5f6';
      jest.spyOn(crypto, 'randomBytes').mockReturnValue(Buffer.from(mockHash, 'hex'));

      const fileUrl = await provider.saveFile(mockFile);

      expect(sendMock).toHaveBeenCalledTimes(1);
      const command = sendMock.mock.calls[0][0];
      expect(command.input.Bucket).toBe('test-bucket');
      expect(command.input.Key).toBe(`${mockHash}-test.jpg`);
      expect(command.input.Body).toBe(mockFile.buffer);
      expect(fileUrl).toBe(`https://test-bucket.s3.us-east-1.amazonaws.com/${mockHash}-test.jpg`);
    });

    it('should throw an error if S3 upload fails', async () => {
        setValidEnv();
        const provider = new S3StorageProvider();
        const sendMock = mockedS3Client.prototype.send as jest.Mock;
        const uploadError = new Error('S3 Error');
        sendMock.mockRejectedValue(uploadError);

        const mockFile = { originalname: 'test.jpg' } as Express.Multer.File;

        await expect(provider.saveFile(mockFile)).rejects.toThrow('Falha ao salvar o arquivo no S3.');
        expect(mockedLogger.error).toHaveBeenCalledWith(expect.any(String), uploadError);
    });
  });

  describe('deleteFile', () => {
    it('should delete a file from S3 based on its URL', async () => {
        setValidEnv();
        const provider = new S3StorageProvider();
        const sendMock = mockedS3Client.prototype.send as jest.Mock;
        sendMock.mockResolvedValue({});

        const fileKey = 'some-hash-test.jpg';
        const fileUrl = `https://test-bucket.s3.us-east-1.amazonaws.com/${fileKey}`;

        await provider.deleteFile(fileUrl);

        expect(sendMock).toHaveBeenCalledTimes(1);
        const command = sendMock.mock.calls[0][0];
        expect(command.input.Bucket).toBe('test-bucket');
        expect(command.input.Key).toBe(fileKey);
    });

    it('should log an error but not throw if deletion fails', async () => {
        setValidEnv();
        const provider = new S3StorageProvider();
        const sendMock = mockedS3Client.prototype.send as jest.Mock;
        const deleteError = new Error('S3 Delete Error');
        sendMock.mockRejectedValue(deleteError);

        await expect(provider.deleteFile('some-url')).resolves.not.toThrow();
        expect(mockedLogger.error).toHaveBeenCalledWith(expect.any(String), deleteError);
    });
  });
});
