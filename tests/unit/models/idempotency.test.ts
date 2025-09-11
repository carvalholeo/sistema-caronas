
import mongoose from 'mongoose';
import { IdempotencyRequestModel } from '../../../src/models/idempotency';
import { v4 as uuidv4 } from 'uuid';

describe('IdempotencyRequest Model', () => {
  beforeEach(async () => {
    await IdempotencyRequestModel.deleteMany({});
  });

  it('should create a new idempotency request in processing state', async () => {
    const key = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const request = new IdempotencyRequestModel({
      key,
      status: 'processing',
      expiresAt,
    });

    const savedRequest = await request.save();
    expect(savedRequest._id).toBeDefined();
    expect(savedRequest.key).toEqual(key);
    expect(savedRequest.status).toBe('processing');
    expect(savedRequest.createdAt).toBeInstanceOf(Date);
  });

  it('should create a new idempotency request in completed state', async () => {
    const key = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const responseBody = { message: 'Success' };

    const request = new IdempotencyRequestModel({
      key,
      status: 'completed',
      responseStatusCode: 200,
      responseBody,
      expiresAt,
    });

    const savedRequest = await request.save();
    expect(savedRequest.status).toBe('completed');
    expect(savedRequest.responseStatusCode).toBe(200);
    expect(savedRequest.responseBody).toEqual(responseBody);
  });

  it('should fail if key is not provided', async () => {
    const request = new IdempotencyRequestModel({
      status: 'processing',
      expiresAt: new Date(),
    });

    await expect(request.save()).rejects.toThrow('IdempotencyRequest validation failed: key: Path `key` is required.');
  });

  it('should fail if status is not provided or invalid', async () => {
    const key = uuidv4();
    const requestInvalidStatus = new IdempotencyRequestModel({
      key,
      status: 'invalid-status',
      expiresAt: new Date(),
    });

    await expect(requestInvalidStatus.save()).rejects.toThrow('Validation failed: status: `invalid-status` is not a valid enum value for path `status`.');

    const requestNoStatus = new IdempotencyRequestModel({
        key,
        expiresAt: new Date(),
    });

    await expect(requestNoStatus.save()).rejects.toThrow('IdempotencyRequest validation failed: status: Path `status` is required.');
  });

  it('should enforce unique key constraint', async () => {
    const key = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const request1 = new IdempotencyRequestModel({ key, status: 'processing', expiresAt });
    await request1.save();

    const request2 = new IdempotencyRequestModel({ key, status: 'completed', expiresAt });
    await expect(request2.save()).rejects.toThrow('E11000 duplicate key error');
  });
});
