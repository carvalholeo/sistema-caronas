
import { validationResult } from 'express-validator';
import { privacyActionValidator, verifyReportValidator } from '../../../../../src/middlewares/validators/admin/privacy';
import { Request } from 'express';
import mongoose from 'mongoose';

// Helper to run validation checks
const runValidation = async (req: Request, validations: any[]) => {
  await Promise.all(validations.map(validation => validation.run(req)));
  return validationResult(req);
};

describe('Admin Privacy Validators', () => {

  describe('privacyActionValidator', () => {
    it('should pass with valid data', async () => {
      const req = {
        params: { targetUserId: new mongoose.Types.ObjectId() },
        body: { twoFactorCode: '123456' }
      } as unknown as Request;
      const errors = await runValidation(req, privacyActionValidator);
      expect(errors.isEmpty()).toBe(true);
    });

    it('should fail with an invalid targetUserId', async () => {
      const req = { params: { targetUserId: 'invalid-id' }, body: { twoFactorCode: '123456' } } as unknown as Request;
      const errors = await runValidation(req, privacyActionValidator);
      expect(errors.array()[0].msg).toBe('ID de usuário inválido.');
    });

    it('should fail with an invalid twoFactorCode', async () => {
        const req = {
            params: { targetUserId: new mongoose.Types.ObjectId() },
            body: { twoFactorCode: '123' }
        } as unknown as Request;
        const errors = await runValidation(req, privacyActionValidator);
        expect(errors.array()[0].msg).toBe('O código 2FA é obrigatório para esta ação.');
    });
  });

  describe('verifyReportValidator', () => {
    it('should pass with a valid 64-character hash', async () => {
      const validHash = 'a'.repeat(64); // 64-character string
      const req = { params: { hash: validHash } } as unknown as Request;
      const errors = await runValidation(req, verifyReportValidator);
      expect(errors.isEmpty()).toBe(true);
    });

    it('should fail with an invalid hash (wrong length)', async () => {
        const req = { params: { hash: 'short-hash' } } as unknown as Request;
        const errors = await runValidation(req, verifyReportValidator);
        expect(errors.isEmpty()).toBe(false);
        expect(errors.array()[0].msg).toBe('Hash de verificação inválido.');
    });

    it('should fail with an invalid hash (not a string)', async () => {
        const req = { params: { hash: 12345 } } as unknown as Request;
        const errors = await runValidation(req, verifyReportValidator);
        expect(errors.isEmpty()).toBe(false);
        expect(errors.array()[0].msg).toBe('Hash de verificação inválido.');
    });
  });
});
