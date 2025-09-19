import { rideService } from '../../../src/services/rideService';
import { RideModel } from '../../../src/models/ride';
import { VehicleModel } from '../../../src/models/vehicle';
import { SearchEventModel, RideViewEventModel } from '../../../src/models/event';
import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import { VehicleStatus, RideStatus, UserRole } from '../../../src/types/enums/enums';
import { IRide, IUser, IVehicle } from '../../../src/types/';

// Mock dependencies
jest.mock('../../../src/models/ride');
jest.mock('../../../src/models/vehicle');
jest.mock('../../../src/models/event');
jest.mock('../../../src/models/user');
jest.mock('crypto', () => ({
  __esModule: true,
  ...jest.requireActual('crypto'),
  randomUUID: jest.fn().mockReturnValue('mock-uuid'),
}));

const mockedRideModel = RideModel as jest.Mocked<typeof RideModel>;
const mockedVehicleModel = VehicleModel as jest.Mocked<typeof VehicleModel>;
const mockedSearchEventModel = SearchEventModel as jest.Mocked<typeof SearchEventModel>;
const mockedRideViewEventModel = RideViewEventModel as jest.Mocked<typeof RideViewEventModel>;
const mockedRandomUUID = randomUUID as jest.Mock;

describe('RideService', () => {
  let mockVehicle: IVehicle;
  let mockRide: IRide;
  let mockDriver: IUser;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDriver = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Driver Test',
      email: 'abcd@efgh.com',
      matricula: 'a123456',
      roles: [UserRole.Motorista],
    } as unknown as IUser;

    mockVehicle = {
      _id: new mongoose.Types.ObjectId(),
      owner: mockDriver,
      status: VehicleStatus.Active,
      capacity: 4,
    } as unknown as IVehicle;

    mockRide = {
      _id: new mongoose.Types.ObjectId(),
      driver: mockDriver,
      vehicle: mockVehicle,
      availableSeats: 3,
      passengers: [],
      status: RideStatus.Scheduled,
      save: jest.fn().mockResolvedValue(true),
      toObject: jest.fn().mockReturnThis(),
    } as unknown as IRide;

    mockedVehicleModel.findOne.mockResolvedValue(mockVehicle);
    (mockedRideModel as unknown as jest.Mock).mockImplementation(() => mockRide);
    mockedRideModel.insertMany.mockResolvedValue([(mockRide as any)]);
    mockedRideModel.findById.mockResolvedValue(mockRide);
    mockedRideModel.findOne.mockResolvedValue(mockRide);
    mockedRideModel.find.mockResolvedValue([(mockRide as any)]);
    mockedRideModel.findOneAndUpdate.mockResolvedValue(mockRide);

    (mockedSearchEventModel as unknown as jest.Mock).mockImplementation(() => ({
      create: jest.fn().mockResolvedValue(true),
    }));
    (mockedRideViewEventModel as unknown as jest.Mock).mockImplementation(() => ({
      create: jest.fn().mockResolvedValue(true),
    }));
  });

  describe('createRide', () => {
    const rideData = {
      vehicle: mockVehicle,
      driver: mockDriver,
      origin: { location: 'A', point: { coordinates: [0, 0] } },
      destination: { location: 'B', point: { coordinates: [1, 1] } },
      departureTime: new Date(),
      availableSeats: 3,
      price: 10,
    };

    it('should throw an error if vehicle is not found or not owned by driver', async () => {
      mockedVehicleModel.findOne.mockResolvedValue(null);
      await expect(rideService.createRide(mockDriver, rideData)).rejects.toThrow('Veículo inválido ou não pertence ao motorista.');
    });

    it('should throw an error if vehicle is not active', async () => {
      mockVehicle.status = VehicleStatus.Inactive;
      await expect(rideService.createRide(mockDriver, rideData)).rejects.toThrow('Veículo inválido ou não pertence ao motorista.');
    });

    it('should throw an error if available seats exceed vehicle capacity', async () => {
      const invalidRideData = { ...rideData, availableSeats: 5 };
      await expect(rideService.createRide(mockDriver, invalidRideData)).rejects.toThrow('A quantidade de assentos excede a capacidade do veículo.');
    });

    it('should successfully create a ride', async () => {
      const result = await rideService.createRide(mockDriver, rideData);

      expect(mockedRideModel).toHaveBeenCalledWith(expect.objectContaining({
        ...rideData,
        driver: mockDriver,
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
      ...mockRide,
      driver: mockDriver,
      vehicle: mockVehicle,
      origin: { location: 'A', point: { coordinates: [0, 0] } },
      destination: { location: 'B', point: { coordinates: [1, 1] } },
      departureTime: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours from now
      price: 10,
      recurrence: recurrenceData,
    } as unknown as IRide;

    it('should throw an error if vehicle is invalid or not active', async () => {
      mockedVehicleModel.findOne.mockResolvedValue(null);
      await expect(rideService.createRecurrentRide(mockDriver, rideData)).rejects.toThrow('Veículo inválido ou não pertence ao motorista.');
    });

    it('should throw an error if available seats exceed vehicle capacity', async () => {
      const invalidRideData = { ...rideData, availableSeats: 5 };
      await expect(rideService.createRecurrentRide(mockDriver, invalidRideData)).rejects.toThrow('A quantidade de assentos excede a capacidade do veículo.');
    });

    it('should throw an error if no valid dates for recurrence', async () => {
      const invalidRecurrenceData = { ...rideData, recurrence: { ...recurrenceData, endDate: new Date(Date.now() - 1000) } };
      await expect(rideService.createRecurrentRide(mockDriver, invalidRecurrenceData)).rejects.toThrow('Nenhuma data válida para a recorrência.');
    });

    it('should successfully create recurrent rides', async () => {
      const rideForRecurrence = {
        ...mockRide,
        driver: mockDriver,
        vehicle: mockVehicle,
        origin: { location: 'A', point: { coordinates: [0, 0] } },
        destination: { location: 'B', point: { coordinates: [1, 1] } },
        departureTime: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours from now
        price: 10,
        recurrence: recurrenceData,
      } as unknown as IRide;

      mockedRandomUUID.mockReturnValue('mock-uuid');
      mockedRideModel.insertMany.mockResolvedValue([rideForRecurrence as any]);


      const result = await rideService.createRecurrentRide(mockDriver, rideForRecurrence);
      const ridesToCreate = mockedRideModel.insertMany.mock.calls[0][0] as Partial<IRide>[];

      expect(mockedRideModel.insertMany).toHaveBeenCalledTimes(1);
      expect(ridesToCreate.length).toBeGreaterThan(0);

      expect(ridesToCreate[0]).toMatchObject({
        driver: mockDriver,
        vehicle: mockVehicle,
        origin: { location: 'A', point: { coordinates: [0, 0] } },
        destination: { location: 'B', point: { coordinates: [1, 1] } },
        price: 10,
        availableSeats: mockRide.availableSeats,
        status: RideStatus.Scheduled,
        isRecurrent: true,
        recurrenceId: 'mock-uuid',
      });

      expect(ridesToCreate[0].departureTime).toBeInstanceOf(Date);
      expect(ridesToCreate[0].departureTime?.getUTCDate()).toBeGreaterThanOrEqual(rideData.departureTime.getUTCDate());
    });
  });
});
