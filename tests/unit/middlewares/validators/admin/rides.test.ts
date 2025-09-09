
import { validationResult } from 'express-validator';
import { adminEditRideValidator, adminCancelRideValidator, adminForcePublishValidator } from '../../../../../src/middlewares/validators/admin/rides';
import { Request } from 'express';
import mongoose from 'mongoose';

// Helper to run validation checks
const runValidation = async (req: Request, validations: any[]) => {
  await Promise.all(validations.map(validation => validation.run(req)));
  return validationResult(req);
};

describe('Admin Rides Validators', () => {

  const validators = {
    adminEditRideValidator,
    adminCancelRideValidator,
    adminForcePublishValidator
  };

  for (const [validatorName, validatorChain] of Object.entries(validators)) {
    describe(validatorName, () => {
      it('should pass with valid data', async () => {
        const req = {
          params: { id: new mongoose.Types.ObjectId() },
          body: { reason: 'Admin action reason' }
        } as unknown as Request;
        const errors = await runValidation(req, validatorChain);
        expect(errors.isEmpty()).toBe(true);
      });

      it('should fail with an invalid ride ID', async () => {
        const req = {
          params: { id: 'invalid-id' },
          body: { reason: 'Admin action reason' }
        } as unknown as Request;
        const errors = await runValidation(req, validatorChain);
        expect(errors.array()[0].msg).toBe('ID da carona inválido.');
      });

      it('should fail if reason is empty', async () => {
        const req = {
          params: { id: new mongoose.Types.ObjectId() },
          body: { reason: '' }
        } as unknown as Request;
        const errors = await runValidation(req, validatorChain);
        expect(errors.array()[0].msg).toContain('obrigatória');
      });
    });
  }
});
