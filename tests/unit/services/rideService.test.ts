
import { rideService } from '../../../src/services/rideService';
import { RideModel } from '../../../src/models/ride';
import { VehicleModel } from '../../../src/models/vehicle';
import { SearchEventModel, RideViewEventModel } from '../../../src/models/event';
import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import { VehicleStatus, RideStatus } from '../../../src/types/enums/enums';

// Mock dependencies
jest.mock('../../../src/models/ride');
jest.mock('../../../src/models/vehicle');
jest.mock('../../../src/models/event');
jest.mock('crypto', () => ({
  __esModule: true,
  ...jest.requireActual('crypto'),
  randomUUID: jest.fn(),
}));

const mockedRideModel = RideModel as jest.Mocked<typeof RideModel>;
const mockedVehicleModel = VehicleModel as jest.Mocked<typeof VehicleModel>;
const mockedSearchEventModel = SearchEventModel as jest.Mocked<typeof SearchEventModel>;
const mockedRideViewEventModel = RideViewEventModel as jest.Mocked<typeof RideViewEventModel>;
const mockedRandomUUID = randomUUID as jest.Mock;

describe('RideService', () => {
  let driverId: mongoose.Types.ObjectId;
  let vehicleId: mongoose.Types.ObjectId;
  let mockVehicle: any;
  let mockRide: any;

  beforeEach(() => {
    jest.clearAllMocks();
    driverId = new mongoose.Types.ObjectId();
    vehicleId = new mongoose.Types.ObjectId();

    mockVehicle = {
      _id: vehicleId,
      owner: driverId,
      status: VehicleStatus.Active,
      capacity: 4,
    };

    mockRide = {
      _id: new mongoose.Types.ObjectId(),
      driver: driverId,
      vehicle: vehicleId,
      availableSeats: 3,
      passengers: [],
      status: RideStatus.Scheduled,
      save: jest.fn().mockResolvedValue(true),
      toObject: jest.fn().mockReturnThis(),
    };

    mockedVehicleModel.findOne.mockResolvedValue(mockVehicle);
    (mockedRideModel as jest.Mock).mockImplementation(() => mockRide);
    mockedRideModel.insertMany.mockResolvedValue([mockRide]);
    mockedRideModel.findById.mockResolvedValue(mockRide);
    mockedRideModel.findOne.mockResolvedValue(mockRide);
    mockedRideModel.find.mockResolvedValue([mockRide]);
    mockedRideModel.findOneAndUpdate.mockResolvedValue(mockRide);

    (mockedSearchEventModel as jest.Mock).mockImplementation(() => ({
      create: jest.fn().mockResolvedValue(true),
    }));
    (mockedRideViewEventModel as jest.Mock).mockImplementation(() => ({
      create: jest.fn().mockResolvedValue(true),
    }));
  });

  describe('createRide', () => {
    const rideData = {
      vehicle: vehicleId,
      origin: { location: 'A', point: { coordinates: [0, 0] } },
      destination: { location: 'B', point: { coordinates: [1, 1] } },
      departureTime: new Date(),
      availableSeats: 3,
      price: 10,
    };

    it('should throw an error if vehicle is not found or not owned by driver', async () => {
      mockedVehicleModel.findOne.mockResolvedValue(null);
      await expect(rideService.createRide(driverId, rideData)).rejects.toThrow('Veículo inválido ou não pertence ao motorista.');
    });

    it('should throw an error if vehicle is not active', async () => {
      mockVehicle.status = VehicleStatus.Inactive;
      await expect(rideService.createRide(driverId, rideData)).rejects.toThrow('Veículo inválido ou não pertence ao motorista.');
    });

    it('should throw an error if available seats exceed vehicle capacity', async () => {
      const invalidRideData = { ...rideData, availableSeats: 5 };
      await expect(rideService.createRide(driverId, invalidRideData)).rejects.toThrow('A quantidade de assentos excede a capacidade do veículo.');
    });

    it('should successfully create a ride', async () => {
      const result = await rideService.createRide(driverId, rideData);

      expect(mockedRideModel).toHaveBeenCalledWith(expect.objectContaining({
        ...rideData,
        driver: driverId,
      }));
      expect(mockRide.save).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockRide);
    });
  });

  describe('createRecurrentRide', () => {
    const recurrenceData = {
      daysOfWeek: [1, 2],
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    };
    const rideData = {
      vehicle: vehicleId,
      origin: { location: 'A', point: { coordinates: [0, 0] } },
      destination: { location: 'B', point: { coordinates: [1, 1] } },
      departureTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
      availableSeats: 3,
      price: 10,
      recurrence: recurrenceData,
    };

    it('should throw an error if vehicle is invalid or not active', async () => {
      mockedVehicleModel.findOne.mockResolvedValue(null);
      await expect(rideService.createRecurrentRide(driverId, rideData)).rejects.toThrow('Veículo inválido ou não pertence ao motorista.');
    });

    it('should throw an error if available seats exceed vehicle capacity', async () => {
      const invalidRideData = { ...rideData, availableSeats: 5 };
      await expect(rideService.createRecurrentRide(driverId, invalidRideData)).rejects.toThrow('A quantidade de assentos excede a capacidade do veículo.');
    });

    it('should throw an error if no valid dates for recurrence', async () => {
      const invalidRecurrenceData = { ...rideData, recurrence: { ...recurrenceData, endDate: new Date(Date.now() - 1000) } };
      await expect(rideService.createRecurrentRide(driverId, invalidRecurrenceData)).rejects.toThrow('Nenhuma data válida para a recorrência.');
    });

    it('should successfully create recurrent rides', async () => {
      mockedRandomUUID.mockReturnValue('mock-uuid');
      const result = await rideService.createRecurrentRide(driverId, rideData);

      expect(mockedRideModel.insertMany).toHaveBeenCalledTimes(1);
      const ridesToCreate = mockedRideModel.insertMany.mock.calls[0][0];
      expect(ridesToCreate.length).toBeGreaterThan(0);
      expect(ridesToCreate[0]).toEqual(expect.objectContaining({
        driver: driverId,
        vehicle: vehicleId,
        isRecurrent: true,
        recurrenceId: 'mock-uuid',
        status: RideStatus.Scheduled,
      }));
      expect(result).toEqual([mockRide]);
    });
  });
});
