
import { Request, Response } from 'express';
import { adminRidesController } from '../../../../src/controllers/admin/ridesController';
import { adminRidesService } from '../../../../src/services/admin/rideService';
import mongoose from 'mongoose';

// Mock dependencies
jest.mock('../../../src/services/admin/rideService');

const mockedAdminRidesService = adminRidesService as jest.Mocked<typeof adminRidesService>;

describe('AdminRidesController', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: jest.Mock;
  let adminUser: any;
  let rideId: mongoose.Types.ObjectId;

  beforeEach(() => {
    jest.clearAllMocks();
    adminUser = { _id: new mongoose.Types.ObjectId(), roles: ['admin'] };
    rideId = new mongoose.Types.ObjectId();
    req = { user: adminUser, params: { rideId: rideId.toString() }, body: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  describe('listRides', () => {
    it('should return a list of rides on success', async () => {
      const mockRides = [{ _id: rideId, status: 'scheduled' }];
      mockedAdminRidesService.listRides.mockResolvedValue(mockRides as any);
      req.query = { status: 'scheduled' };

      await adminRidesController.listRides(req as Request, res as Response);

      expect(mockedAdminRidesService.listRides).toHaveBeenCalledWith(req.query);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockRides);
    });

    it('should return 500 and error message on failure', async () => {
      const errorMessage = 'Service error';
      mockedAdminRidesService.listRides.mockRejectedValue(new Error(errorMessage));

      await adminRidesController.listRides(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Erro ao listar caronas.', error: errorMessage });
    });
  });

  describe('getRideDetails', () => {
    it('should return ride details on success', async () => {
      const mockRideDetails = { _id: rideId, driver: 'driver123' };
      mockedAdminRidesService.getRideDetails.mockResolvedValue(mockRideDetails as any);

      await adminRidesController.getRideDetails(req as Request, res as Response);

      expect(mockedAdminRidesService.getRideDetails).toHaveBeenCalledWith(
        rideId, adminUser._id
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockRideDetails);
    });

    it('should return 404 and error message if ride not found', async () => {
      const errorMessage = 'Carona não encontrada.';
      mockedAdminRidesService.getRideDetails.mockRejectedValue(new Error(errorMessage));

      await adminRidesController.getRideDetails(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: errorMessage });
    });
  });

  describe('updateRide', () => {
    it('should return updated ride on success', async () => {
      const mockUpdatedRide = { _id: rideId, price: 150 };
      mockedAdminRidesService.updateRide.mockResolvedValue(mockUpdatedRide as any);
      req.body = { reason: 'Price change', price: 150 };

      await adminRidesController.updateRide(req as Request, res as Response);

      expect(mockedAdminRidesService.updateRide).toHaveBeenCalledWith(
        rideId, adminUser, 'Price change', { price: 150 }
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockUpdatedRide);
    });

    it('should return 403 and error message on failure', async () => {
      const errorMessage = 'Cannot edit ride';
      mockedAdminRidesService.updateRide.mockRejectedValue(new Error(errorMessage));
      req.body = { reason: 'Price change', price: 150 };

      await adminRidesController.updateRide(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: errorMessage });
    });
  });

  describe('cancelRide', () => {
    it('should return cancelled ride on success', async () => {
      const mockCancelledRide = { _id: rideId, status: 'cancelled' };
      mockedAdminRidesService.cancelRide.mockResolvedValue(mockCancelledRide as any);
      req.body = { reason: 'Driver unavailable' };

      await adminRidesController.cancelRide(req as Request, res as Response);

      expect(mockedAdminRidesService.cancelRide).toHaveBeenCalledWith(
        rideId, adminUser._id, 'Driver unavailable'
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockCancelledRide);
    });

    it('should return 403 and error message on failure', async () => {
      const errorMessage = 'Cancellation failed';
      mockedAdminRidesService.cancelRide.mockRejectedValue(new Error(errorMessage));
      req.body = { reason: 'Driver unavailable' };

      await adminRidesController.cancelRide(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: errorMessage });
    });
  });

  describe('forcePublishRide', () => {
    it('should return published ride on success', async () => {
      const mockPublishedRide = { _id: rideId, status: 'scheduled' };
      mockedAdminRidesService.forcePublishRide.mockResolvedValue(mockPublishedRide as any);
      req.body = { reason: 'Approved by admin' };

      await adminRidesController.forcePublishRide(req as Request, res as Response);

      expect(mockedAdminRidesService.forcePublishRide).toHaveBeenCalledWith(
        rideId, adminUser._id, 'Approved by admin'
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockPublishedRide);
    });

    it('should return 403 and error message on failure', async () => {
      const errorMessage = 'Publish failed';
      mockedAdminRidesService.forcePublishRide.mockRejectedValue(new Error(errorMessage));
      req.body = { reason: 'Approved by admin' };

      await adminRidesController.forcePublishRide(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: errorMessage });
    });
  });
});
