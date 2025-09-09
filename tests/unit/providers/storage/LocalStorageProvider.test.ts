
import { LocalStorageProvider } from '../../../../src/providers/storage/LocalStorageProvider';
import fs from 'fs/promises';
import logger from '../../../../src/utils/logger';
import path from 'path';

// Mock dependencies
jest.mock('fs/promises');
jest.mock('../../../src/utils/logger');

const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedLogger = logger as jest.Mocked<typeof logger>;

describe('LocalStorageProvider', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Constructor', () => {
    it('should attempt to create the uploads directory', () => {
      new LocalStorageProvider();
      expect(mockedFs.mkdir).toHaveBeenCalledWith(expect.any(String), { recursive: true });
    });
  });

  describe('saveFile', () => {
    it('should return the default localhost URL if APP_BASE_URL is not set', async () => {
      const provider = new LocalStorageProvider();
      const mockFile = { filename: 'test-file.jpg' } as Express.Multer.File;
      const url = await provider.saveFile(mockFile);
      expect(url).toBe('http://localhost:3000/uploads/test-file.jpg');
    });

    it('should return the URL based on APP_BASE_URL', async () => {
      process.env.APP_BASE_URL = 'https://my-app.com';
      const provider = new LocalStorageProvider();
      const mockFile = { filename: 'test-file.jpg' } as Express.Multer.File;
      const url = await provider.saveFile(mockFile);
      expect(url).toBe('https://my-app.com/uploads/test-file.jpg');
    });
  });

  describe('deleteFile', () => {
    const uploadsDir = path.resolve(__dirname, '..', '..', '..', '..', 'src', 'providers', 'storage', '..', '..', '..', 'uploads');

    it('should call fs.unlink with the correct file path', async () => {
      const provider = new LocalStorageProvider();
      const filename = 'test-to-delete.jpg';
      const fileUrl = `http://localhost:3000/uploads/${filename}`;
      const expectedPath = path.join(uploadsDir, filename);

      mockedFs.unlink.mockResolvedValue(undefined);

      await provider.deleteFile(fileUrl);
      expect(mockedFs.unlink).toHaveBeenCalledWith(expectedPath);
    });

    it('should log an error if deletion fails for reasons other than ENOENT', async () => {
        const provider = new LocalStorageProvider();
        const deleteError = new Error('Permission denied');
        (deleteError as any).code = 'EACCES';
        mockedFs.unlink.mockRejectedValue(deleteError);

        await provider.deleteFile('some-url');

        expect(mockedLogger.error).toHaveBeenCalledWith('Erro ao deletar arquivo local:', deleteError);
    });

    it('should ignore an error if the file does not exist (ENOENT)', async () => {
        const provider = new LocalStorageProvider();
        const enoentError = new Error('File not found');
        (enoentError as any).code = 'ENOENT';
        mockedFs.unlink.mockRejectedValue(enoentError);

        await provider.deleteFile('some-url');

        expect(mockedLogger.error).not.toHaveBeenCalled();
    });
  });
});
