
import { locationService } from '../../../src/services/locationService';
import { RideModel } from '../../../src/models/ride';
import { LocationLogModel } from '../../../src/models/locationLog';
import { BlockModel } from '../../../src/models/block';
import mongoose from 'mongoose';
import { RideStatus, LocationLogAction } from '../../../src/types/enums/enums';
import { Server, Socket } from 'socket.io';

// Mock dependencies
jest.mock('../../../src/models/ride');
jest.mock('../../../src/models/locationLog');
jest.mock('../../../src/models/block');

const mockedRideModel = RideModel as jest.Mocked<typeof RideModel>;
const mockedLocationLogModel = LocationLogModel as jest.Mocked<typeof LocationLogModel>;
const mockedBlockModel = BlockModel as jest.Mocked<typeof BlockModel>;

describe('LocationService', () => {
  let rideId: mongoose.Types.ObjectId;
  let userId: mongoose.Types.ObjectId;
  let driverId: mongoose.Types.ObjectId;
  let passengerId: mongoose.Types.ObjectId;
  let mockRide: any;

  beforeEach(() => {
    jest.clearAllMocks();
    rideId = new mongoose.Types.ObjectId();
    userId = new mongoose.Types.ObjectId();
    driverId = new mongoose.Types.ObjectId();
    passengerId = new mongoose.Types.ObjectId();

    mockRide = {
      _id: rideId,
      status: RideStatus.InProgress,
      driver: { _id: driverId },
      passengers: [
        { user: passengerId, status: 'approved' },
        { user: new mongoose.Types.ObjectId(), status: 'pending' },
      ],
    };

    mockedRideModel.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(mockRide) } as any);
    (mockedLocationLogModel as jest.Mock).mockImplementation(() => ({
      save: jest.fn().mockResolvedValue(true),
    }));
  });

  describe('validateUserForLocationRoom', () => {
    it('should throw an error if ride is not found', async () => {
      mockedRideModel.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) } as any);
      await expect(locationService.validateUserForLocationRoom(rideId, userId)).rejects.toThrow('Carona não encontrada.');
    });

    it('should throw an error if ride is not in progress', async () => {
      mockRide.status = RideStatus.Scheduled;
      await expect(locationService.validateUserForLocationRoom(rideId, userId)).rejects.toThrow('Não é possível entrar na sala: a carona não está em andamento.');
    });

    it('should throw an error if user is not driver and not approved passenger', async () => {
      await expect(locationService.validateUserForLocationRoom(rideId, new mongoose.Types.ObjectId())).rejects.toThrow('Você não tem permissão para acessar a localização desta carona.');
    });

    it('should return ride if user is driver', async () => {
      const result = await locationService.validateUserForLocationRoom(rideId, driverId);
      expect(result).toEqual(mockRide);
    });

    it('should return ride if user is approved passenger', async () => {
      const result = await locationService.validateUserForLocationRoom(rideId, passengerId);
      expect(result).toEqual(mockRide);
    });
  });

  describe('logSharingActivity', () => {
    it('should not log if ride is not found', async () => {
      mockedRideModel.findById.mockResolvedValue(null);
      await locationService.logSharingActivity(rideId, driverId, LocationLogAction.SharingStarted);
      expect(mockedLocationLogModel).not.toHaveBeenCalled();
    });

    it('should not log if user is not the driver', async () => {
      mockedRideModel.findById.mockResolvedValue(mockRide);
      await locationService.logSharingActivity(rideId, userId, LocationLogAction.SharingStarted);
      expect(mockedLocationLogModel).not.toHaveBeenCalled();
    });

    it('should log sharing activity if user is the driver', async () => {
      mockedRideModel.findById.mockResolvedValue(mockRide);
      await locationService.logSharingActivity(rideId, driverId, LocationLogAction.SharingStarted);
      expect(mockedLocationLogModel).toHaveBeenCalledWith({
        ride: rideId,
        user: driverId,
        action: LocationLogAction.SharingStarted,
      });
      const logInstance = (mockedLocationLogModel as jest.Mock).mock.results[0].value;
      expect(logInstance.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('broadcastLocationUpdate', () => {
    let io: Server;
    let socket: Socket;

    beforeEach(() => {
      io = { in: jest.fn().mockReturnThis(), fetchSockets: jest.fn() } as unknown as Server;
      socket = { rooms: new Set(), userId: new mongoose.Types.ObjectId().toString(), id: 'socket1' } as unknown as Socket;
    });

    it('should not broadcast if socket is not in the room', async () => {
      socket.rooms.clear();
      await locationService.broadcastLocationUpdate(io, socket, { rideId, lat: 10, lng: 20 });
      expect(io.in).not.toHaveBeenCalled();
    });

    it('should not broadcast if ride is not found', async () => {
      socket.rooms.add(`ride-location-${rideId}`);
      mockedRideModel.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) } as any);
      await locationService.broadcastLocationUpdate(io, socket, { rideId, lat: 10, lng: 20 });
      expect(io.in).toHaveBeenCalled();
      expect(io.fetchSockets).not.toHaveBeenCalled();
    });

    it('should broadcast driver location to all other participants', async () => {
      socket.rooms.add(`ride-location-${rideId}`);
      socket.userId = driverId.toString();
      mockRide.driver._id = driverId;
      mockedRideModel.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(mockRide) } as any);

      const mockTargetSocket1 = { id: 'socket2', userId: passengerId.toString(), emit: jest.fn() };
      const mockTargetSocket2 = { id: 'socket3', userId: new mongoose.Types.ObjectId().toString(), emit: jest.fn() };
      (io.in as jest.Mock).mockReturnThis();
      (io.fetchSockets as jest.Mock).mockResolvedValue([socket, mockTargetSocket1, mockTargetSocket2]);

      await locationService.broadcastLocationUpdate(io, socket, { rideId, lat: 10, lng: 20 });

      expect(mockTargetSocket1.emit).toHaveBeenCalledWith('locationUpdate', {
        userId: socket.userId,
        lat: 10,
        lng: 20,
        role: 'driver',
      });
      expect(mockTargetSocket2.emit).toHaveBeenCalledWith('locationUpdate', {
        userId: socket.userId,
        lat: 10,
        lng: 20,
        role: 'driver',
      });
    });

    it('should broadcast passenger location only to the driver', async () => {
        socket.rooms.add(`ride-location-${rideId}`);
        socket.userId = passengerId.toString();
        mockRide.driver._id = driverId;
        mockedRideModel.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(mockRide) } as any);
  
        const mockTargetSocketDriver = { id: 'socketDriver', userId: driverId.toString(), emit: jest.fn() };
        const mockTargetSocketPassenger = { id: 'socketPassenger', userId: new mongoose.Types.ObjectId().toString(), emit: jest.fn() };
        (io.in as jest.Mock).mockReturnThis();
        (io.fetchSockets as jest.Mock).mockResolvedValue([socket, mockTargetSocketDriver, mockTargetSocketPassenger]);
  
        await locationService.broadcastLocationUpdate(io, socket, { rideId, lat: 10, lng: 20 });
  
        expect(mockTargetSocketDriver.emit).toHaveBeenCalledWith('locationUpdate', {
          userId: socket.userId,
          lat: 10,
          lng: 20,
          role: 'passenger',
        });
        expect(mockTargetSocketPassenger.emit).not.toHaveBeenCalled(); // Should not send to other passengers
    });

    it('should not broadcast to blocked users', async () => {
        socket.rooms.add(`ride-location-${rideId}`);
        socket.userId = driverId.toString();
        mockRide.driver._id = driverId;
        mockedRideModel.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(mockRide) } as any);
  
        const mockTargetSocket = { id: 'socket2', userId: passengerId.toString(), emit: jest.fn() };
        (io.in as jest.Mock).mockReturnThis();
        (io.fetchSockets as jest.Mock).mockResolvedValue([socket, mockTargetSocket]);
  
        mockedBlockModel.findOne.mockResolvedValue({}); // Simulate a block exists
  
        await locationService.broadcastLocationUpdate(io, socket, { rideId, lat: 10, lng: 20 });
  
        expect(mockTargetSocket.emit).not.toHaveBeenCalled();
    });
  });

  describe('removeUserLocation', () => {
    let socket: Socket;
    let mockIo: Server;

    beforeEach(() => {
        socket = { 
            rooms: new Set(['room1', 'ride-location-123', 'ride-location-456']), 
            userId: 'user123', 
            to: jest.fn().mockReturnThis(), 
            emit: jest.fn() 
        } as unknown as Socket;
        mockIo = { in: jest.fn().mockReturnThis(), fetchSockets: jest.fn() } as unknown as Server;
    });

    it('should emit userLocationRemoved to all relevant location rooms', async () => {
        await locationService.removeUserLocation(socket);

        expect(socket.to).toHaveBeenCalledWith('ride-location-123');
        expect(socket.to).toHaveBeenCalledWith('ride-location-456');
        expect(socket.emit).toHaveBeenCalledWith('userLocationRemoved', { userId: 'user123' });
        expect(socket.to).toHaveBeenCalledTimes(2); // Called for each location room
    });

    it('should do nothing if socket is not in any location rooms', async () => {
        socket.rooms = new Set(['room1', 'room2']);
        await locationService.removeUserLocation(socket);
        expect(socket.to).not.toHaveBeenCalled();
    });
  });
});
