
import { adminRidesService } from '../../../../src/services/admin/rideService';
import { RideModel } from '../../../../src/models/ride';
import { AuditLogModel } from '../../../../src/models/auditLog';
import mongoose from 'mongoose';
import { AuditActionType, RideStatus } from '../../../../src/types/enums/enums';

// Mock dependencies
jest.mock('../../../src/models/ride');
jest.mock('../../../src/models/auditLog');

const mockedRideModel = RideModel as jest.Mocked<typeof RideModel>;
const mockedAuditLogModel = AuditLogModel as jest.Mocked<typeof AuditLogModel>;

describe('AdminRidesService', () => {
  let adminId: mongoose.Types.ObjectId;
  let rideId: mongoose.Types.ObjectId;
  let mockRide: any;

  beforeEach(() => {
    jest.clearAllMocks();
    adminId = new mongoose.Types.ObjectId();
    rideId = new mongoose.Types.ObjectId();
    mockRide = {
      _id: rideId,
      status: RideStatus.Scheduled,
      driver: new mongoose.Types.ObjectId(),
      passengers: [],
      save: jest.fn().mockResolvedValue(true),
      toObject: jest.fn().mockReturnValue({ _id: rideId, status: RideStatus.Scheduled }),
    };

    // Mock AuditLogModel constructor and save method
    (mockedAuditLogModel as jest.Mock).mockImplementation(() => ({
      save: jest.fn().mockResolvedValue(undefined),
    }));
  });

  describe('getRideDetails', () => {
    it('should return ride details and log audit entry if ride is found', async () => {
      mockedRideModel.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue(mockRide) } as any);

      const result = await adminRidesService.getRideDetails(rideId, adminId);

      expect(mockedRideModel.findById).toHaveBeenCalledWith(rideId);
      expect(result).toEqual(mockRide);
      expect(mockedAuditLogModel).toHaveBeenCalledTimes(1);
      const auditLogCall = (mockedAuditLogModel as jest.Mock).mock.calls[0][0];
      expect(auditLogCall.action.actionType).toBe(AuditActionType.RIDE_DETAILS_VIEWED_BY_ADMIN);
      expect(auditLogCall.target.resourceId).toEqual(rideId);
    });

    it('should return null and not log audit entry if ride is not found', async () => {
      mockedRideModel.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue(null) } as any);

      const result = await adminRidesService.getRideDetails(rideId, adminId);

      expect(mockedRideModel.findById).toHaveBeenCalledWith(rideId);
      expect(result).toBeNull();
      expect(mockedAuditLogModel).not.toHaveBeenCalled();
    });
  });

  describe('cancelRide', () => {
    const reason = 'Admin cancellation';

    it('should cancel the ride and log audit entry', async () => {
      mockedRideModel.findById.mockResolvedValue(mockRide);

      const result = await adminRidesService.cancelRide(rideId, adminId, reason);

      expect(mockedRideModel.findById).toHaveBeenCalledWith(rideId);
      expect(mockRide.status).toBe(RideStatus.Cancelled);
      expect(mockRide.save).toHaveBeenCalledTimes(1);
      expect(mockedAuditLogModel).toHaveBeenCalledTimes(1);
      const auditLogCall = (mockedAuditLogModel as jest.Mock).mock.calls[0][0];
      expect(auditLogCall.action.actionType).toBe(AuditActionType.RIDE_CANCELLED_BY_ADMIN);
      expect(auditLogCall.action.detail).toBe(reason);
      expect(result).toEqual(mockRide);
    });

    it('should throw an error if ride is not found', async () => {
      mockedRideModel.findById.mockResolvedValue(null);
      await expect(adminRidesService.cancelRide(rideId, adminId, reason)).rejects.toThrow('Carona não encontrada.');
    });
  });

  describe('forcePublishRide', () => {
    const reason = 'Admin force publish';

    it('should force publish the ride and log audit entry', async () => {
      mockedRideModel.findOne.mockResolvedValue(mockRide);

      const result = await adminRidesService.forcePublishRide(rideId, adminId, reason);

      expect(mockedRideModel.findOne).toHaveBeenCalledWith({ _id: rideId, status: RideStatus.Cancelled });
      expect(mockRide.status).toBe(RideStatus.Scheduled);
      expect(mockRide.save).toHaveBeenCalledTimes(1);
      expect(mockedAuditLogModel).toHaveBeenCalledTimes(1);
      const auditLogCall = (mockedAuditLogModel as jest.Mock).mock.calls[0][0];
      expect(auditLogCall.action.actionType).toBe(AuditActionType.RIDE_FORCE_PUBLISHED_BY_ADMIN);
      expect(auditLogCall.action.detail).toBe(reason);
      expect(result).toEqual(mockRide);
    });

    it('should throw an error if ride is not found', async () => {
      mockedRideModel.findOne.mockResolvedValue(null);
      await expect(adminRidesService.forcePublishRide(rideId, adminId, reason)).rejects.toThrow('Carona não encontrada.');
    });
  });

  describe('listRides', () => {
    it('should return all rides if no filters are provided', async () => {
      const mockRides = [mockRide, { ...mockRide, _id: new mongoose.Types.ObjectId() }];
      mockedRideModel.find.mockReturnValue({ populate: jest.fn().mockResolvedValue(mockRides) } as any);

      const result = await adminRidesService.listRides({});

      expect(mockedRideModel.find).toHaveBeenCalledWith({});
      expect(result).toEqual(mockRides);
    });

    it('should filter rides by status', async () => {
      const mockRides = [mockRide];
      mockedRideModel.find.mockReturnValue({ populate: jest.fn().mockResolvedValue(mockRides) } as any);

      const result = await adminRidesService.listRides({ status: RideStatus.Scheduled });

      expect(mockedRideModel.find).toHaveBeenCalledWith({ status: RideStatus.Scheduled });
      expect(result).toEqual(mockRides);
    });

    it('should filter rides by driverId', async () => {
      const mockRides = [mockRide];
      const driverId = new mongoose.Types.ObjectId();
      mockedRideModel.find.mockReturnValue({ populate: jest.fn().mockResolvedValue(mockRides) } as any);

      const result = await adminRidesService.listRides({ driverId: driverId.toString() });

      expect(mockedRideModel.find).toHaveBeenCalledWith({ driver: driverId });
      expect(result).toEqual(mockRides);
    });
  });

  describe('updateRide', () => {
    const updateData = { price: 150 };
    const reason = 'Admin price adjustment';

    it('should update the ride and log audit entry', async () => {
      mockedRideModel.findById.mockResolvedValue(mockRide);

      const result = await adminRidesService.updateRide(rideId, adminId, reason, updateData);

      expect(mockedRideModel.findById).toHaveBeenCalledWith(rideId);
      expect(mockRide.price).toBe(updateData.price);
      expect(mockRide.save).toHaveBeenCalledTimes(1);
      expect(mockedAuditLogModel).toHaveBeenCalledTimes(1);
      const auditLogCall = (mockedAuditLogModel as jest.Mock).mock.calls[0][0];
      expect(auditLogCall.action.actionType).toBe(AuditActionType.RIDE_UPDATED_BY_ADMIN);
      expect(auditLogCall.action.detail).toBe(reason);
      expect(auditLogCall.target.beforeState).toEqual({ _id: rideId, status: RideStatus.Scheduled });
      expect(auditLogCall.target.afterState).toEqual(updateData);
      expect(result).toEqual(mockRide);
    });

    it('should throw an error if ride is not found', async () => {
      mockedRideModel.findById.mockResolvedValue(null);
      await expect(adminRidesService.updateRide(rideId, adminId, reason, updateData)).rejects.toThrow('Carona não encontrada.');
    });

    it('should throw an error if ride status is in progress, completed or cancelled', async () => {
        mockRide.status = RideStatus.InProgress;
        mockedRideModel.findById.mockResolvedValue(mockRide);
        await expect(adminRidesService.updateRide(rideId, adminId, reason, updateData)).rejects.toThrow('Não é possível editar uma carona que já está em andamento, foi concluída ou cancelada.');

        mockRide.status = RideStatus.Completed;
        mockedRideModel.findById.mockResolvedValue(mockRide);
        await expect(adminRidesService.updateRide(rideId, adminId, reason, updateData)).rejects.toThrow('Não é possível editar uma carona que já está em andamento, foi concluída ou cancelada.');

        mockRide.status = RideStatus.Cancelled;
        mockedRideModel.findById.mockResolvedValue(mockRide);
        await expect(adminRidesService.updateRide(rideId, adminId, reason, updateData)).rejects.toThrow('Não é possível editar uma carona que já está em andamento, foi concluída ou cancelada.');
    });
  });
});
