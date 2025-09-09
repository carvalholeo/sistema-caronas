
import { validationResult } from 'express-validator';
import { vehicleValidator } from '../../../../src/middlewares/validators/vehicle';
import { Request } from 'express';

// Helper to run validation checks
const runValidation = async (req: Request, validations: any[]) => {
  await Promise.all(validations.map(validation => validation.run(req)));
  return validationResult(req);
};

describe('Vehicle Validator', () => {

  const validVehicleData = {
    plate: 'ABC-1234',
    make: 'Ford',
    model: 'Fiesta',
    year: 2020,
    color: 'White',
    capacity: 5
  };

  it('should pass with valid vehicle data', async () => {
    const req = { body: validVehicleData } as Request;
    const errors = await runValidation(req, vehicleValidator);
    expect(errors.isEmpty()).toBe(true);
  });

  it('should fail if plate is missing', async () => {
    const req = { body: { ...validVehicleData, plate: '' } } as Request;
    const errors = await runValidation(req, vehicleValidator);
    expect(errors.array()[0].msg).toBe('A placa é obrigatória.');
  });

  it('should fail if make is missing', async () => {
    const req = { body: { ...validVehicleData, make: '' } } as Request;
    const errors = await runValidation(req, vehicleValidator);
    expect(errors.array()[0].msg).toBe('A marca é obrigatória.');
  });

  it('should fail with an invalid year', async () => {
    const req = { body: { ...validVehicleData, year: 1970 } } as Request;
    const errors = await runValidation(req, vehicleValidator);
    expect(errors.array()[0].msg).toBe('O ano deve ser um número válido.');
  });

  it('should fail with an invalid capacity', async () => {
    const req = { body: { ...validVehicleData, capacity: 0 } } as Request;
    const errors = await runValidation(req, vehicleValidator);
    expect(errors.array()[0].msg).toBe('A capacidade deve ser de no mínimo 1.');
  });
});
