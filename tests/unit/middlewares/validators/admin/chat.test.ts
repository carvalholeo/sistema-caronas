
import { validationResult } from 'express-validator';
import { readChatValidator, moderateMessageValidator, exportChatValidator } from '../../../../../src/middlewares/validators/admin/chat';
import { Request } from 'express';
import mongoose from 'mongoose';

// Helper to run validation checks
const runValidation = async (req: Request, validations: any[]) => {
  await Promise.all(validations.map(validation => validation.run(req)));
  return validationResult(req);
};

describe('Admin Chat Validators', () => {

  describe('readChatValidator', () => {
    it('should pass with valid mongo IDs', async () => {
      const req = { params: { rideId: new mongoose.Types.ObjectId(), user1Id: new mongoose.Types.ObjectId(), user2Id: new mongoose.Types.ObjectId() } } as unknown as Request;
      const errors = await runValidation(req, readChatValidator);
      expect(errors.isEmpty()).toBe(true);
    });

    it('should fail with an invalid rideId', async () => {
      const req = { params: { rideId: 'invalid-id' } } as unknown as Request;
      const errors = await runValidation(req, readChatValidator);
      expect(errors.isEmpty()).toBe(false);
      expect(errors.array()[0].msg).toBe('Invalid value');
    });
  });

  describe('moderateMessageValidator', () => {
    it('should pass with valid data', async () => {
      const req = { params: { messageId: new mongoose.Types.ObjectId() }, body: { reason: 'Inappropriate content' } } as unknown as Request;
      const errors = await runValidation(req, moderateMessageValidator);
      expect(errors.isEmpty()).toBe(true);
    });

    it('should fail if reason is empty', async () => {
        const req = { params: { messageId: new mongoose.Types.ObjectId() }, body: { reason: '' } } as unknown as Request;
        const errors = await runValidation(req, moderateMessageValidator);
        expect(errors.array()[0].msg).toBe('A razão da moderação é obrigatória.');
    });
  });

  describe('exportChatValidator', () => {
    it('should pass with valid data', async () => {
        const req = {
            params: { rideId: new mongoose.Types.ObjectId(), user1Id: new mongoose.Types.ObjectId(), user2Id: new mongoose.Types.ObjectId() },
            body: { twoFactorCode: '123456' }
        } as unknown as Request;
        const errors = await runValidation(req, exportChatValidator);
        expect(errors.isEmpty()).toBe(true);
    });

    it('should fail with an invalid twoFactorCode', async () => {
        const req = {
            params: { rideId: new mongoose.Types.ObjectId(), user1Id: new mongoose.Types.ObjectId(), user2Id: new mongoose.Types.ObjectId() },
            body: { twoFactorCode: '123' }
        } as unknown as Request;
        const errors = await runValidation(req, exportChatValidator);
        expect(errors.array()[0].msg).toBe('O código 2FA é obrigatório.');
    });
  });
});
