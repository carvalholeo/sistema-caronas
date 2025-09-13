describe('Upload and Multer Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Upload Destination Logic', () => {
    it('should set isCloudUploadDestination to false when UPLOAD_DESTINATION is not "cloud"', () => {
      process.env.UPLOAD_DESTINATION = 'local';
      delete require.cache[require.resolve('../../../src/config/uploadAndMulter')];
      const { isCloudUploadDestination } = require('../../../src/config/uploadAndMulter');
      expect(isCloudUploadDestination).toBe(false);
    });

    it('should set isCloudUploadDestination to true when UPLOAD_DESTINATION is "cloud"', () => {
      process.env.UPLOAD_DESTINATION = 'cloud';
      delete require.cache[require.resolve('../../../src/config/uploadAndMulter')];
      const { isCloudUploadDestination } = require('../../../src/config/uploadAndMulter');
      expect(isCloudUploadDestination).toBe(true);
    });

    it('should default to false when UPLOAD_DESTINATION is not set', () => {
      delete process.env.UPLOAD_DESTINATION;
      delete require.cache[require.resolve('../../../src/config/uploadAndMulter')];
      const { isCloudUploadDestination } = require('../../../src/config/uploadAndMulter');
      expect(isCloudUploadDestination).toBe(false);
    });
  });

  describe('Export Tests', () => {
    it('should export upload object', () => {
      const uploadConfig = require('../../../src/config/uploadAndMulter');
      expect(uploadConfig.upload).toBeDefined();
      expect(typeof uploadConfig.upload).toBe('object');
    });

    it('should export isCloudUploadDestination boolean', () => {
      const uploadConfig = require('../../../src/config/uploadAndMulter');
      expect(typeof uploadConfig.isCloudUploadDestination).toBe('boolean');
    });
  });
});
