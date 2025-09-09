import { vehicleService } from '../../../src/services/vehicleService';
import { VehicleModel } from '../../../src/models/vehicle';
import { UserModel } from '../../../src/models/user';
import mongoose from 'mongoose';
import { VehicleStatus, UserRole } from '../../../src/types/enums/enums';

// Mock dependencies
jest.mock('../../../src/models/vehicle');
jest.mock('../../../src/models/user');

const mockedVehicleModel = VehicleModel as jest.Mocked<typeof VehicleModel>;
const mockedUserModel = UserModel as jest.Mocked<typeof UserModel>;

describe('VehicleService', () => {
  let ownerId: mongoose.Types.ObjectId;

  beforeEach(() => {
    jest.clearAllMocks();
    ownerId = new mongoose.Types.ObjectId();

    // Mock VehicleModel constructor and save method
    (mockedVehicleModel as jest.Mock).mockImplementation((data) => ({
      ...data,
      save: jest.fn().mockResolvedValue(true),
    }));

    // Mock UserModel.updateOne
    mockedUserModel.updateOne.mockResolvedValue({ acknowledged: true, modifiedCount: 1 } as any);
  });

  describe('createVehicle', () => {
    const vehicleData = {
      plate: 'ABC1234',
      make: 'Ford',
      model: 'Fiesta',
      year: 2020,
      color: 'White',
      capacity: 4,
    };

    it('should create a new vehicle with Active status if no existing active vehicle with same plate', async () => {
      mockedVehicleModel.findOne.mockResolvedValue(null);

      const result = await vehicleService.createVehicle(ownerId, vehicleData);

      expect(mockedVehicleModel.findOne).toHaveBeenCalledWith({ plate: vehicleData.plate, status: VehicleStatus.Active });
      expect(mockedVehicleModel).toHaveBeenCalledWith(expect.objectContaining({
        ...vehicleData,
        owner: ownerId,
        status: VehicleStatus.Active,
      }));
      expect(result.save).toHaveBeenCalledTimes(1);
      expect(mockedUserModel.updateOne).toHaveBeenCalledWith(
        { _id: ownerId, roles: { $ne: UserRole.Motorista } },
        { $addToSet: { roles: UserRole.Motorista } }
      );
      expect(result.plate).toBe(vehicleData.plate);
    });

    it('should create a new vehicle with Pending status if existing active vehicle with same plate', async () => {
      mockedVehicleModel.findOne.mockResolvedValue({ _id: new mongoose.Types.ObjectId(), plate: vehicleData.plate, status: VehicleStatus.Active });

      const result = await vehicleService.createVehicle(ownerId, vehicleData);

      expect(mockedVehicleModel.findOne).toHaveBeenCalledWith({ plate: vehicleData.plate, status: VehicleStatus.Active });
      expect(mockedVehicleModel).toHaveBeenCalledWith(expect.objectContaining({
        ...vehicleData,
        owner: ownerId,
        status: VehicleStatus.Pending,
      }));
      expect(result.save).toHaveBeenCalledTimes(1);
      expect(mockedUserModel.updateOne).toHaveBeenCalledTimes(1);
      expect(result.plate).toBe(vehicleData.plate);
    });
  });

  describe('getVehiclesByOwner', () => {
    it('should return all vehicles for a given owner ID', async () => {
      const mockVehicles = [
        { _id: new mongoose.Types.ObjectId(), plate: 'VEH1' },
        { _id: new mongoose.Types.ObjectId(), plate: 'VEH2' },
      ];
      mockedVehicleModel.find.mockResolvedValue(mockVehicles as any);

      const result = await vehicleService.getVehiclesByOwner(ownerId);

      expect(mockedVehicleModel.find).toHaveBeenCalledWith({ owner: ownerId });
      expect(result).toEqual(mockVehicles);
    });
  });
});