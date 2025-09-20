import 'socket.io';
import { locationService } from '../../../src/services/locationService';
import { RideModel } from '../../../src/models/ride';
import { LocationLogModel } from '../../../src/models/locationLog';
import { BlockModel } from '../../../src/models/block';
import mongoose from 'mongoose';
import { RideStatus, LocationLogAction, PassengerStatus } from '../../../src/types/enums/enums';
import { Server, Socket } from 'socket.io';
import { IRide, IRidePassenger, IUser } from '../../../src/types';

// Mock dependencies
jest.mock('../../../src/models/ride');
jest.mock('../../../src/models/locationLog');
jest.mock('../../../src/models/block');

const mockedRideModel = RideModel as jest.Mocked<typeof RideModel>;
const mockedLocationLogModel = LocationLogModel as jest.Mocked<typeof LocationLogModel>;
const mockedBlockModel = BlockModel as jest.Mocked<typeof BlockModel>;

declare module 'socket.io' {
  // Aqui você estende a interface original do Socket
  export interface Socket {
    // Adicione as suas propriedades personalizadas com os tipos corretos
    userId: IUser;
    sessionId: string;
  }
}

describe('LocationService', () => {
  let rideId: IRide;
  let userId: IUser;
  let driverId: IUser;
  let passengerOneId: IUser;
  let passengerTwoId: IUser;
  let mockRide: any;

  beforeEach(() => {
    jest.clearAllMocks();
    rideId = new mongoose.Types.ObjectId() as unknown as IRide;
    userId = new mongoose.Types.ObjectId() as unknown as IUser;
    driverId = new mongoose.Types.ObjectId() as unknown as IUser;
    passengerOneId = new mongoose.Types.ObjectId() as unknown as IUser;
    passengerTwoId = new mongoose.Types.ObjectId() as unknown as IUser;

    mockRide = {
      _id: rideId,
      status: RideStatus.InProgress,
      driver: driverId,
      passengers: [
        { user: passengerOneId, status: PassengerStatus.Approved } as unknown as IRidePassenger,
        { user: passengerTwoId, status: PassengerStatus.Pending } as unknown as IRidePassenger,
      ],
    };

    mockedRideModel.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(mockRide) } as any);
    mockedRideModel.findById.mockReturnValue(mockRide as any);
    (mockedLocationLogModel as unknown as jest.Mock).mockImplementation(() => ({
      save: jest.fn().mockResolvedValue(true),
    }));
  });

  describe('validateUserForLocationRoom', () => {
    it('should throw an error if ride is not found', async () => {
      mockedRideModel.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) } as any);
      mockedRideModel.findById.mockReturnValue(null as any);
      await expect(locationService.validateUserForLocationRoom(rideId, userId)).rejects.toThrow('Carona não encontrada.');
    });

    it('should throw an error if ride is not scheduled or in progress', async () => {
      mockRide.status = RideStatus.Cancelled;
      mockedRideModel.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(mockRide) } as any);
      mockedRideModel.findById.mockReturnValue(mockRide as any);

      await expect(locationService.validateUserForLocationRoom(rideId, userId)).rejects.toThrow('Não é possível entrar na sala: a carona não iniciou ou não está em andamento.');
    });

    it('should throw an error if user is not driver and not approved passenger', async () => {
      await expect(locationService.validateUserForLocationRoom(rideId, passengerTwoId)).rejects.toThrow('Você não tem permissão para acessar a localização desta carona.');
    });

    it('should return ride if user is driver', async () => {
      const result = await locationService.validateUserForLocationRoom(rideId, driverId);
      expect(result).toEqual(mockRide);
    });

    it('should return ride if user is approved passenger', async () => {
      const result = await locationService.validateUserForLocationRoom(rideId, passengerOneId);
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
      const logInstance = (mockedLocationLogModel as unknown as jest.Mock).mock.results[0].value;
      expect(logInstance.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('broadcastLocationUpdate', () => {
    let io: Server;
    let socket: Socket;

    beforeEach(() => {
      io = { in: jest.fn().mockReturnThis(), fetchSockets: jest.fn() } as unknown as Server;
      socket = { rooms: new Set(), userId: passengerTwoId, id: 'socket1' } as unknown as Socket;
    });

    it('should not broadcast if socket is not in the room', async () => {
      socket.rooms.clear();
      await locationService.broadcastLocationUpdate(io, socket, { rideId, lat: 10, lng: 20 });
      expect(io.in).not.toHaveBeenCalled();
    });

    it('should not broadcast if ride is not found', async () => {
      socket.rooms.add(`ride-location-${rideId}`);
      mockedRideModel.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) } as any);
      mockedRideModel.findById.mockReturnValue(null as any);

      await locationService.broadcastLocationUpdate(io, socket, { rideId, lat: 10, lng: 20 });

      expect(io.in).not.toHaveBeenCalled();
      expect(io.fetchSockets).not.toHaveBeenCalled();
    });

    it('should broadcast driver location to all other participants', async () => {
      socket.rooms.add(`ride-location-${rideId}`);
      socket.userId = driverId;
      mockRide.driver = driverId;
      mockedRideModel.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(mockRide) } as any);
      mockedRideModel.findById.mockReturnValue(mockRide as any);

      const mockTargetSocket1 = { id: 'socket2', userId: passengerOneId, emit: jest.fn() };
      const mockTargetSocket2 = { id: 'socket3', userId: passengerTwoId, emit: jest.fn() };
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
      socket.userId = passengerOneId;
      mockRide.driver = driverId;
      mockedRideModel.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(mockRide) } as any);
      mockedRideModel.findById.mockReturnValue(mockRide as any);

      const mockTargetSocketDriver = { id: 'socketDriver', userId: driverId, emit: jest.fn() };
      const mockTargetSocketPassenger = { id: 'socketPassenger', userId: passengerTwoId, emit: jest.fn() };
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
      socket.userId = driverId;
      mockRide.driver = driverId;
      mockedRideModel.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(mockRide) } as any);

      const mockTargetSocket = { id: 'socket2', userId: passengerOneId, emit: jest.fn() };
      (io.in as jest.Mock).mockReturnThis();
      (io.fetchSockets as jest.Mock).mockResolvedValue([socket, mockTargetSocket]);

      mockedBlockModel.findOne.mockResolvedValue({}); // Simulate a block exists

      await locationService.broadcastLocationUpdate(io, socket, { rideId, lat: 10, lng: 20 });

      expect(mockTargetSocket.emit).not.toHaveBeenCalled();
    });
  });

  describe('removeUserLocation', () => {
    let socket: Socket;

    beforeEach(() => {
      socket = {
        rooms: new Set(['room1', 'ride-location-123', 'ride-location-456']),
        userId: 'user123',
        to: jest.fn().mockReturnThis(),
        emit: jest.fn()
      } as unknown as Socket;
    });

    it('should emit userLocationRemoved to all relevant location rooms', async () => {
      await locationService.removeUserLocation(socket);

      expect(socket.to).toHaveBeenCalledWith('ride-location-123');
      expect(socket.to).toHaveBeenCalledWith('ride-location-456');
      expect(socket.emit).toHaveBeenCalledWith('userLocationRemoved', { userId: 'user123' });
      expect(socket.to).toHaveBeenCalledTimes(2); // Called for each location room
    });

    it('should do nothing if socket is not in any location rooms', async () => {
      socket = {
        ...socket,
        rooms: new Set(['room1', 'room2']),
      } as unknown as Socket;
      await locationService.removeUserLocation(socket);
      expect(socket.to).not.toHaveBeenCalled();
    });
  });
});
