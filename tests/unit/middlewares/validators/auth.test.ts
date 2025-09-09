
import { validationResult } from 'express-validator';
import { registerValidator, loginValidator, twoFactorValidator, requestResetValidator, completeResetValidator } from '../../../../src/middlewares/validators/auth';
import { Request } from 'express';

// Helper to run validation checks
const runValidation = async (req: Request, validations: any[]) => {
  await Promise.all(validations.map(validation => validation.run(req)));
  return validationResult(req);
};

describe('Auth Validators', () => {

  describe('registerValidator', () => {
    it('should pass with valid registration data', async () => {
      const req = { body: { email: 'test@example.com', matricula: 'A123', password: 'StrongPass123!', name: 'Test User' } } as Request;
      const errors = await runValidation(req, registerValidator);
      expect(errors.isEmpty()).toBe(true);
    });

    it('should fail with an invalid email', async () => {
      const req = { body: { email: 'invalid-email', matricula: 'A123', password: 'StrongPass123!', name: 'Test User' } } as Request;
      const errors = await runValidation(req, registerValidator);
      expect(errors.array()[0].msg).toBe('Formato de e-mail inválido.');
    });

    it('should fail if matricula does not start with a letter', async () => {
        const req = { body: { email: 'test@example.com', matricula: '123A', password: 'StrongPass123!', name: 'Test User' } } as Request;
        const errors = await runValidation(req, registerValidator);
        expect(errors.array()[0].msg).toBe('A matrícula deve iniciar com uma letra.');
    });

    it('should fail with a weak password', async () => {
        const req = { body: { email: 'test@example.com', matricula: 'A123', password: 'weak', name: 'Test User' } } as Request;
        const errors = await runValidation(req, registerValidator);
        expect(errors.array()[0].msg).toBe('A senha não atende aos critérios de segurança.');
    });
  });

  describe('loginValidator', () => {
    it('should pass with valid login data', async () => {
      const req = { body: { email: 'test@example.com', password: 'password123' } } as Request;
      const errors = await runValidation(req, loginValidator);
      expect(errors.isEmpty()).toBe(true);
    });

    it('should fail if password is empty', async () => {
      const req = { body: { email: 'test@example.com', password: '' } } as Request;
      const errors = await runValidation(req, loginValidator);
      expect(errors.array()[0].msg).toBe('A senha é obrigatória.');
    });
  });

  describe('twoFactorValidator', () => {
    it('should pass with valid 2FA data', async () => {
        const req = { body: { code: '123456', token: 'some-jwt-token' } } as Request;
        const errors = await runValidation(req, twoFactorValidator);
        expect(errors.isEmpty()).toBe(true);
    });

    it('should fail with an invalid code length', async () => {
        const req = { body: { code: '123', token: 'some-jwt-token' } } as Request;
        const errors = await runValidation(req, twoFactorValidator);
        expect(errors.array()[0].msg).toBe('O código 2FA deve ter 6 dígitos.');
    });
  });

  describe('requestResetValidator', () => {
    it('should pass with a valid email', async () => {
        const req = { body: { email: 'reset@example.com' } } as Request;
        const errors = await runValidation(req, requestResetValidator);
        expect(errors.isEmpty()).toBe(true);
    });
  });

  describe('completeResetValidator', () => {
    it('should pass with valid reset data', async () => {
        const req = { body: { token: 'a1b2c3d4'.repeat(8), newPassword: 'NewStrongPass123!' } } as Request;
        const errors = await runValidation(req, completeResetValidator);
        expect(errors.isEmpty()).toBe(true);
    });

    it('should fail with an invalid token', async () => {
        const req = { body: { token: 'invalid-token', newPassword: 'NewStrongPass123!' } } as Request;
        const errors = await runValidation(req, completeResetValidator);
        expect(errors.array()[0].msg).toBe('O token é obrigatório.');
    });
  });
});
