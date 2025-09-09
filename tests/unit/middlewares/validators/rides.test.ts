
import { validationResult } from 'express-validator';
import {
  rideValidator,
  recurrentRideValidator,
  manageSeatValidator
} from '../../../../src/middlewares/validators/rides';
import { Request } from 'express';
import mongoose from 'mongoose';

// Helper to run validation checks
const runValidation = async (req: Request, validations: any[]) => {
  await Promise.all(validations.map(validation => validation.run(req)));
  return validationResult(req);
};

describe('Rides Validators', () => {

  const validRideData = {
    vehicle: new mongoose.Types.ObjectId(),
    origin: { location: 'City A', point: { coordinates: [-46, -23] } },
    destination: { location: 'City B', point: { coordinates: [-47, -24] } },
    departureTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    availableSeats: 3,
    price: 100
  };

  describe('rideValidator', () => {
    it('should pass with valid ride data', async () => {
      const req = { body: validRideData } as Request;
      const errors = await runValidation(req, rideValidator);
      expect(errors.isEmpty()).toBe(true);
    });

    it('should fail with an invalid vehicle ID', async () => {
      const req = { body: { ...validRideData, vehicle: 'invalid-id' } } as Request;
      const errors = await runValidation(req, rideValidator);
      expect(errors.array()[0].msg).toBe('ID de veículo inválido.');
    });

    it('should fail with invalid availableSeats', async () => {
        const req = { body: { ...validRideData, availableSeats: 0 } } as Request;
        const errors = await runValidation(req, rideValidator);
        expect(errors.array()[0].msg).toBe('Pelo menos um assento deve estar disponível.');
    });
  });

  describe('recurrentRideValidator', () => {
    const validRecurrenceData = {
        ...validRideData,
        recurrence: {
            daysOfWeek: [1, 3, 5],
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        }
    };

    it('should pass with valid recurrent ride data', async () => {
        const req = { body: validRecurrenceData } as Request;
        const errors = await runValidation(req, recurrentRideValidator);
        expect(errors.isEmpty()).toBe(true);
    });

    it('should fail if recurrence rules are missing', async () => {
        const req = { body: { ...validRideData, recurrence: undefined } } as Request;
        const errors = await runValidation(req, recurrentRideValidator);
        expect(errors.array()[0].msg).toBe('As regras de recorrência são obrigatórias.');
    });

    it('should fail with an invalid endDate', async () => {
        const req = { body: { ...validRecurrenceData, recurrence: { ...validRecurrenceData.recurrence, endDate: 'invalid' } } } as Request;
        const errors = await runValidation(req, recurrentRideValidator);
        expect(errors.array()[0].msg).toBe('A data final da recorrência é inválida.');
    });
  });

  describe('manageSeatValidator', () => {
    it('should pass with valid data', async () => {
        const req = {
            params: { id: new mongoose.Types.ObjectId() },
            body: { passengerId: new mongoose.Types.ObjectId(), action: 'approve' }
        } as unknown as Request;
        const errors = await runValidation(req, manageSeatValidator);
        expect(errors.isEmpty()).toBe(true);
    });

    it('should fail with an invalid action', async () => {
        const req = {
            params: { id: new mongoose.Types.ObjectId() },
            body: { passengerId: new mongoose.Types.ObjectId(), action: 'invalid-action' }
        } as unknown as Request;
        const errors = await runValidation(req, manageSeatValidator);
        expect(errors.array()[0].msg).toBe('Ação inválida.');
    });
  });
});
