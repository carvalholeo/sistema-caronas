
import { validationResult } from 'express-validator';
import { userUpdateValidator } from '../../../../src/middlewares/validators/users';
import { Request } from 'express';

// Helper to run validation checks
const runValidation = async (req: Request, validations: any[]) => {
  await Promise.all(validations.map(validation => validation.run(req)));
  return validationResult(req);
};

describe('Users Validators', () => {

  describe('userUpdateValidator', () => {
    it('should pass with valid data', async () => {
      const req = { body: { email: 'new@example.com', name: 'New Name' } } as Request;
      const errors = await runValidation(req, userUpdateValidator);
      expect(errors.isEmpty()).toBe(true);
    });

    it('should pass with only a valid email', async () => {
        const req = { body: { email: 'new@example.com' } } as Request;
        const errors = await runValidation(req, userUpdateValidator);
        expect(errors.isEmpty()).toBe(true);
    });

    it('should pass with only a valid name', async () => {
        const req = { body: { name: 'New Name' } } as Request;
        const errors = await runValidation(req, userUpdateValidator);
        expect(errors.isEmpty()).toBe(true);
    });

    it('should pass with an empty body', async () => {
        const req = { body: {} } as Request;
        const errors = await runValidation(req, userUpdateValidator);
        expect(errors.isEmpty()).toBe(true);
    });

    it('should fail with an invalid email format', async () => {
      const req = { body: { email: 'invalid-email' } } as Request;
      const errors = await runValidation(req, userUpdateValidator);
      expect(errors.array()[0].msg).toBe('Please provide a valid email address.');
    });

    it('should fail with an empty name', async () => {
        const req = { body: { name: '' } } as Request;
        const errors = await runValidation(req, userUpdateValidator);
        expect(errors.array()[0].msg).toBe('Name cannot be empty.');
    });
  });
});
