
import { idempotencyService } from '../../../src/services/idempotencyService';
import { IdempotencyRequestModel } from '../../../src/models/idempotency';

// Mock dependencies
jest.mock('../../../src/models/idempotency');

const mockedIdempotencyRequestModel = IdempotencyRequestModel as jest.Mocked<typeof IdempotencyRequestModel>;

describe('IdempotencyService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getRequest', () => {
    it('should return the request if found', async () => {
      const mockRequest = { key: 'test-key', status: 'processing' };
      mockedIdempotencyRequestModel.findOne.mockResolvedValue(mockRequest as any);

      const result = await idempotencyService.getRequest('test-key');

      expect(mockedIdempotencyRequestModel.findOne).toHaveBeenCalledWith({ key: 'test-key' });
      expect(result).toEqual(mockRequest);
    });

    it('should return null if request is not found', async () => {
      mockedIdempotencyRequestModel.findOne.mockResolvedValue(null);

      const result = await idempotencyService.getRequest('non-existent-key');

      expect(mockedIdempotencyRequestModel.findOne).toHaveBeenCalledWith({ key: 'non-existent-key' });
      expect(result).toBeNull();
    });
  });

  describe('startRequest', () => {
    it('should create and save a new processing request', async () => {
      const mockSave = jest.fn().mockResolvedValue(true);
      (mockedIdempotencyRequestModel as jest.Mock).mockImplementation(() => ({
        save: mockSave,
      }));

      const key = 'new-request-key';
      await idempotencyService.startRequest(key);

      expect(mockedIdempotencyRequestModel).toHaveBeenCalledTimes(1);
      const newRequestInstance = (mockedIdempotencyRequestModel as jest.Mock).mock.calls[0][0];
      expect(newRequestInstance.key).toBe(key);
      expect(newRequestInstance.status).toBe('processing');
      expect(newRequestInstance.expiresAt).toBeInstanceOf(Date);
      expect(mockSave).toHaveBeenCalledTimes(1);
    });
  });

  describe('completeRequest', () => {
    it('should update the request status to completed with response data', async () => {
      const key = 'completed-request-key';
      const statusCode = 200;
      const body = { message: 'Success' };

      mockedIdempotencyRequestModel.updateOne.mockResolvedValue({ acknowledged: true, modifiedCount: 1 } as any);

      await idempotencyService.completeRequest(key, statusCode, body);

      expect(mockedIdempotencyRequestModel.updateOne).toHaveBeenCalledWith(
        { key },
        { $set: { status: 'completed', responseStatusCode: statusCode, responseBody: body } }
      );
    });
  });
});
