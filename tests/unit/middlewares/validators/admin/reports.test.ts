
import { validationResult } from 'express-validator';
import { dateRangeValidator, singleDateValidator } from '../../../../../src/middlewares/validators/admin/reports';
import { Request } from 'express';

// Helper to run validation checks
const runValidation = async (req: Request, validations: any[]) => {
  await Promise.all(validations.map(validation => validation.run(req)));
  return validationResult(req);
};

describe('Admin Reports Validators', () => {

  describe('dateRangeValidator', () => {
    it('should pass with valid ISO8601 dates', async () => {
      const req = { query: { startDate: '2023-01-01T00:00:00.000Z', endDate: '2023-01-31T23:59:59.999Z' } } as unknown as Request;
      const errors = await runValidation(req, dateRangeValidator);
      expect(errors.isEmpty()).toBe(true);
    });

    it('should fail with an invalid startDate', async () => {
      const req = { query: { startDate: 'not-a-date', endDate: '2023-01-31T23:59:59.999Z' } } as unknown as Request;
      const errors = await runValidation(req, dateRangeValidator);
      expect(errors.array()[0].msg).toBe('Data de início inválida.');
    });

    it('should fail with an invalid endDate', async () => {
        const req = { query: { startDate: '2023-01-01T00:00:00.000Z', endDate: 'not-a-date' } } as unknown as Request;
        const errors = await runValidation(req, dateRangeValidator);
        expect(errors.array()[0].msg).toBe('Data de fim inválida.');
    });
  });

  describe('singleDateValidator', () => {
    it('should pass with a valid ISO8601 endDate', async () => {
        const req = { query: { endDate: '2023-01-31T23:59:59.999Z' } } as unknown as Request;
        const errors = await runValidation(req, singleDateValidator);
        expect(errors.isEmpty()).toBe(true);
    });

    it('should fail with an invalid endDate', async () => {
        const req = { query: { endDate: 'not-a-date' } } as unknown as Request;
        const errors = await runValidation(req, singleDateValidator);
        expect(errors.array()[0].msg).toBe('Data de fim inválida.');
    });
  });
});
