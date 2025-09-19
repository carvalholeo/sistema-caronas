import { adminRidesService } from '../../../../src/services/admin/rideService';
import { RideModel } from '../../../../src/models/ride';
import { AuditLogModel } from '../../../../src/models/auditLog';
import mongoose from 'mongoose';
import { RideStatus, VehicleStatus } from '../../../../src/types/enums/enums';
import { IRide, IUser, IVehicle } from '../../../../src/types';

// Mock dependencies
jest.mock('../../../../src/models/ride');
jest.mock('../../../../src/models/auditLog');

const mockedRideModel = RideModel as jest.Mocked<typeof RideModel>;
const mockedAuditLogModel = AuditLogModel as jest.Mocked<typeof AuditLogModel>;

describe('AdminRidesService', () => {
  let adminId: IUser;
  let driver: IUser;
  let mockRide: IRide;
  let vehicle: IVehicle;

  beforeEach(() => {
    jest.clearAllMocks();
    adminId = { _id: new mongoose.Types.ObjectId() } as IUser;
    driver = { _id: new mongoose.Types.ObjectId(), name: 'Driver User', matricula: 'DRIVER123' } as IUser;
    vehicle = {
      _id: new mongoose.Types.ObjectId(),
      plate: 'ABC1234',
      make: 'Car Make',
      carModel: 'Car Model',
      color: 'Red',
      owner: driver,
      year: 2020,
      capacity: 4,
      status: VehicleStatus.Active
    } as unknown as IVehicle;
    const origin = { type: 'Point', coordinates: [-46.57421, -23.57333] };

    mockRide = {
      _id: new mongoose.Types.ObjectId(),
      status: RideStatus.Scheduled,
      driver,
      vehicle,
      passengers: [],
      save: jest.fn().mockResolvedValue(true),
    } as unknown as IRide;

    mockRide = {
      ...mockRide,
      toObject: jest.fn().mockReturnValue({ _id: mockRide._id, status: RideStatus.Scheduled }),
    } as unknown as IRide;
  });

  describe('getRideDetails', () => {
    it('should return ride details and log audit entry if ride is found', async () => {
      mockedRideModel.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue(mockRide) } as any);

      const result = await adminRidesService.getRideDetails(mockRide, adminId);

      expect(mockedRideModel.findById).toHaveBeenCalledWith(mockRide);
      expect(result).toEqual(mockRide);
      expect(mockedAuditLogModel).toHaveBeenCalledTimes(1);
    });

    it('should return null and not log audit entry if ride is not found', async () => {
      mockedRideModel.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue(null) } as any);

      const result = await adminRidesService.getRideDetails(mockRide, adminId);

      expect(mockedRideModel.findById).toHaveBeenCalledWith(mockRide);
      expect(result).toBeNull();
      expect(mockedAuditLogModel).not.toHaveBeenCalled();
    });
  });

  describe('cancelRide', () => {
    const reason = 'Admin cancellation';

    it('should cancel the ride and log audit entry', async () => {
      mockedRideModel.findById.mockResolvedValue(mockRide);

      const result = await adminRidesService.cancelRide(mockRide, adminId, reason);

      expect(mockedRideModel.findById).toHaveBeenCalledWith(mockRide);
      expect(mockRide.status).toBe(RideStatus.Cancelled);
      expect(mockRide.save).toHaveBeenCalledTimes(1);
      expect(mockedAuditLogModel).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockRide);
    });

    it('should throw an error if ride is not found', async () => {
      mockedRideModel.findById.mockResolvedValue(null);
      await expect(adminRidesService.cancelRide(mockRide, adminId, reason)).rejects.toThrow('Carona não encontrada.');
    });
  });

  describe('forcePublishRide', () => {
    const reason = 'Admin force publish';

    it('should force publish the ride and log audit entry', async () => {
      mockedRideModel.findOne.mockResolvedValue(mockRide);

      const result = await adminRidesService.forcePublishRide(mockRide, adminId, reason);

      expect(mockedRideModel.findOne).toHaveBeenCalledWith({ _id: mockRide, status: RideStatus.Cancelled });
      expect(mockRide.status).toBe(RideStatus.Scheduled);
      expect(mockRide.save).toHaveBeenCalledTimes(1);
      expect(mockedAuditLogModel).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockRide);
    });

    it('should throw an error if ride is not found', async () => {
      mockedRideModel.findOne.mockResolvedValue(null);
      await expect(adminRidesService.forcePublishRide(mockRide, adminId, reason)).rejects.toThrow('Carona não encontrada.');
    });
  });

  describe('listRides', () => {
    it('should return all rides if no filters are provided', async () => {
      const mockRides = [mockRide, { ...mockRide, _id: new mongoose.Types.ObjectId() }];

      // --- CORREÇÃO APLICADA AQUI ---
      // Criamos um mock para o segundo 'populate' que resolve o valor final
      const finalQuery = {
        populate: jest.fn().mockResolvedValue(mockRides)
      };
      // O primeiro 'populate' retorna o objeto que contém o segundo 'populate'
      const mockQuery = {
        populate: jest.fn().mockReturnValue(finalQuery)
      };
      mockedRideModel.find.mockReturnValue(mockQuery as any);

      const result = await adminRidesService.listRides({});

      expect(mockedRideModel.find).toHaveBeenCalledWith({});
      // Verifica se os dois 'populate' foram chamados corretamente
      expect(mockQuery.populate).toHaveBeenCalledWith('driver', 'name email');
      expect(finalQuery.populate).toHaveBeenCalledWith('passengers.user', 'name email');
      expect(result).toEqual(mockRides);
    });

    it('should filter rides by status', async () => {
      const mockRides = [mockRide];

      // --- CORREÇÃO APLICADA AQUI ---
      const finalQuery = { populate: jest.fn().mockResolvedValue(mockRides) };
      const mockQuery = { populate: jest.fn().mockReturnValue(finalQuery) };
      mockedRideModel.find.mockReturnValue(mockQuery as any);

      const result = await adminRidesService.listRides({ status: RideStatus.Scheduled });

      expect(mockedRideModel.find).toHaveBeenCalledWith({ status: RideStatus.Scheduled });
      expect(result).toEqual(mockRides);
    });

    it('should filter rides by driverId', async () => {
      const mockRides = [mockRide];
      const driverId = new mongoose.Types.ObjectId();

      // --- CORREÇÃO APLICADA AQUI ---
      const finalQuery = { populate: jest.fn().mockResolvedValue(mockRides) };
      const mockQuery = { populate: jest.fn().mockReturnValue(finalQuery) };
      mockedRideModel.find.mockReturnValue(mockQuery as any);

      const result = await adminRidesService.listRides({ driverId: driverId });

      expect(mockedRideModel.find).toHaveBeenCalledWith({ driver: driverId });
      expect(result).toEqual(mockRides);
    });
  });

  describe('updateRide', () => {
    const updateData = { price: 150 };
    const reason = 'Admin price adjustment';

    it('should update the ride and log audit entry', async () => {
      mockedRideModel.findById.mockResolvedValue(mockRide);

      const result = await adminRidesService.updateRide(mockRide, adminId, reason, updateData);

      expect(mockedRideModel.findById).toHaveBeenCalledWith(mockRide);
      expect(mockRide.price).toBe(updateData.price);
      expect(mockRide.save).toHaveBeenCalledTimes(1);
      expect(mockedAuditLogModel).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockRide);
    });

    it('should throw an error if ride is not found', async () => {
      mockedRideModel.findById.mockResolvedValue(null);
      await expect(adminRidesService.updateRide(mockRide, adminId, reason, updateData)).rejects.toThrow('Carona não encontrada.');
    });

    it('should throw an error if ride status is in progress, completed or cancelled', async () => {
      mockRide.status = RideStatus.InProgress;
      mockedRideModel.findById.mockResolvedValue(mockRide);
      await expect(adminRidesService.updateRide(mockRide, adminId, reason, updateData)).rejects.toThrow('Não é possível editar uma carona que já está em andamento, foi concluída ou cancelada.');

      mockRide.status = RideStatus.Completed;
      mockedRideModel.findById.mockResolvedValue(mockRide);
      await expect(adminRidesService.updateRide(mockRide, adminId, reason, updateData)).rejects.toThrow('Não é possível editar uma carona que já está em andamento, foi concluída ou cancelada.');

      mockRide.status = RideStatus.Cancelled;
      mockedRideModel.findById.mockResolvedValue(mockRide);
      await expect(adminRidesService.updateRide(mockRide, adminId, reason, updateData)).rejects.toThrow('Não é possível editar uma carona que já está em andamento, foi concluída ou cancelada.');
    });
  });
});
