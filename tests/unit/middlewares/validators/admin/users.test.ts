
import { validationResult } from 'express-validator';
import {
  updateUserStatusValidator,
  updateUserValidator,
  promoteAdminValidator,
  demoteAdminValidator,
  permissionsValidator
} from '../../../../../src/middlewares/validators/admin/users';
import { Request } from 'express';
import mongoose from 'mongoose';
import { UserStatus } from '../../../../../src/types/enums/enums';

// Helper to run validation checks
const runValidation = async (req: Request, validations: any[]) => {
  await Promise.all(validations.map(validation => validation.run(req)));
  return validationResult(req);
};

describe('Admin Users Validators', () => {
  const targetUserId = new mongoose.Types.ObjectId();

  describe('updateUserStatusValidator', () => {
    it('should pass for a simple status change', async () => {
      const req = { params: { targetUserId }, body: { status: UserStatus.Approved } } as unknown as Request;
      const errors = await runValidation(req, updateUserStatusValidator);
      expect(errors.isEmpty()).toBe(true);
    });

    it('should require a reason when banning a user', async () => {
      const req = { params: { targetUserId }, body: { status: UserStatus.Banned, twoFactorCode: '123456' } } as unknown as Request;
      const errors = await runValidation(req, updateUserStatusValidator);
      expect(errors.array()[0].msg).toBe('A razão é obrigatória para esta ação.');
    });

    it('should require a 2FA code when banning a user', async () => {
        const req = { params: { targetUserId }, body: { status: UserStatus.Banned, reason: 'Violation' } } as unknown as Request;
        const errors = await runValidation(req, updateUserStatusValidator);
        expect(errors.array()[0].msg).toBe('O código 2FA é obrigatório para esta ação.');
    });

    it('should pass when banning with reason and 2FA code', async () => {
        const req = { params: { targetUserId }, body: { status: UserStatus.Banned, reason: 'Violation', twoFactorCode: '123456' } } as unknown as Request;
        const errors = await runValidation(req, updateUserStatusValidator);
        expect(errors.isEmpty()).toBe(true);
    });
  });

  describe('updateUserValidator', () => {
    it('should pass if not disabling 2FA', async () => {
        const req = { params: { targetUserId }, body: { disableTwoFactor: false } } as unknown as Request;
        const errors = await runValidation(req, updateUserValidator);
        expect(errors.isEmpty()).toBe(true);
    });

    it('should require reason and 2FA when disabling 2FA', async () => {
        let req = { params: { targetUserId }, body: { disableTwoFactor: true, twoFactorCode: '123456' } } as unknown as Request;
        let errors = await runValidation(req, updateUserValidator);
        expect(errors.array()[0].msg).toBe('A razão é obrigatória para desativar o 2FA.');

        req = { params: { targetUserId }, body: { disableTwoFactor: true, reason: 'User request' } } as unknown as Request;
        errors = await runValidation(req, updateUserValidator);
        expect(errors.array()[0].msg).toBe('O seu código 2FA é obrigatório para esta ação.');
    });
  });

  describe('promoteAdminValidator', () => {
    it('should pass with valid data', async () => {
        const req = { params: { targetUserId }, body: { twoFactorCode: '123456' } } as unknown as Request;
        const errors = await runValidation(req, promoteAdminValidator);
        expect(errors.isEmpty()).toBe(true);
    });
  });

  describe('demoteAdminValidator', () => {
    it('should pass with valid data', async () => {
        const req = { params: { targetUserId }, body: { reason: 'Demotion reason', twoFactorCode: '123456' } } as unknown as Request;
        const errors = await runValidation(req, demoteAdminValidator);
        expect(errors.isEmpty()).toBe(true);
    });

    it('should fail if reason is missing', async () => {
        const req = { params: { targetUserId }, body: { twoFactorCode: '123456' } } as unknown as Request;
        const errors = await runValidation(req, demoteAdminValidator);
        expect(errors.array()[0].msg).toBe('A razão é obrigatória.');
    });
  });

  describe('permissionsValidator', () => {
    it('should pass with a valid permissions array', async () => {
        const req = { params: { targetUserId }, body: { permissions: ['users:edit', 'rides:delete'] } } as unknown as Request;
        const errors = await runValidation(req, permissionsValidator);
        expect(errors.isEmpty()).toBe(true);
    });

    it('should fail if permissions is not an array', async () => {
        const req = { params: { targetUserId }, body: { permissions: 'users:edit' } } as unknown as Request;
        const errors = await runValidation(req, permissionsValidator);
        expect(errors.array()[0].msg).toBe('Permissões devem ser uma lista.');
    });
  });
});
