
import { validationResult } from 'express-validator';
import { blockDetailsValidator, forceLogoutValidator } from '../../../../../src/middlewares/validators/admin/security';
import { Request } from 'express';
import mongoose from 'mongoose';

// Helper to run validation checks
const runValidation = async (req: Request, validations: any[]) => {
  await Promise.all(validations.map(validation => validation.run(req)));
  return validationResult(req);
};

describe('Admin Security Validators', () => {

  describe('blockDetailsValidator', () => {
    it('should pass with valid data', async () => {
      const req = {
        params: { blockId: new mongoose.Types.ObjectId() },
        body: { twoFactorCode: '123456' }
      } as unknown as Request;
      const errors = await runValidation(req, blockDetailsValidator);
      expect(errors.isEmpty()).toBe(true);
    });

    it('should fail with an invalid blockId', async () => {
        const req = {
            params: { blockId: 'invalid-id' },
            body: { twoFactorCode: '123456' }
        } as unknown as Request;
        const errors = await runValidation(req, blockDetailsValidator);
        expect(errors.isEmpty()).toBe(false);
    });

    it('should fail with an invalid twoFactorCode', async () => {
        const req = {
            params: { blockId: new mongoose.Types.ObjectId() },
            body: { twoFactorCode: '123' }
        } as unknown as Request;
        const errors = await runValidation(req, blockDetailsValidator);
        expect(errors.array()[0].msg).toBe('O código 2FA é obrigatório.');
    });
  });

  describe('forceLogoutValidator', () => {
    it('should pass with valid data', async () => {
        const req = {
          params: { targetUserId: new mongoose.Types.ObjectId() },
          body: { twoFactorCode: '123456' }
        } as unknown as Request;
        const errors = await runValidation(req, forceLogoutValidator);
        expect(errors.isEmpty()).toBe(true);
      });
  
      it('should fail with an invalid targetUserId', async () => {
          const req = {
              params: { targetUserId: 'invalid-id' },
              body: { twoFactorCode: '123456' }
          } as unknown as Request;
          const errors = await runValidation(req, forceLogoutValidator);
          expect(errors.isEmpty()).toBe(false);
      });
  
      it('should fail with an invalid twoFactorCode', async () => {
          const req = {
              params: { targetUserId: new mongoose.Types.ObjectId() },
              body: { twoFactorCode: 'abc' }
          } as unknown as Request;
          const errors = await runValidation(req, forceLogoutValidator);
          expect(errors.array()[0].msg).toBe('O código 2FA é obrigatório.');
      });
  });
});
