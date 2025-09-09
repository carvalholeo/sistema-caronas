
import { Server, Socket } from 'socket.io';
import { setupLocationSockets } from '../../../../src/providers/socket/locationSocket';
import { RideModel } from '../../../../src/models/ride';
import { BlockModel } from '../../../../src/models/block';
import { locationService } from '../../../../src/services/locationService';
import { RideStatus } from '../../../../src/types/enums/enums';
import mongoose from 'mongoose';

// Mock dependencies
jest.mock('../../../src/models/ride');
jest.mock('../../../src/models/locationLog');
jest.mock('../../../src/models/block');
jest.mock('../../../src/services/locationService');

const mockedRideModel = RideModel as jest.Mocked<typeof RideModel>;
const mockedBlockModel = BlockModel as jest.Mocked<typeof BlockModel>;

describe('Location Socket Provider', () => {
  let io: Server;
  let socket: Socket;
  let connectionCallback: (socket: Socket) => void;

  beforeEach(() => {
    // Create mock server and socket
    io = { on: jest.fn(), in: jest.fn().mockReturnThis(), fetchSockets: jest.fn() } as unknown as Server;
    socket = {
      on: jest.fn(),
      emit: jest.fn(),
      join: jest.fn(),
      rooms: new Set(),
      userId: new mongoose.Types.ObjectId().toString(),
    } as unknown as Socket;

    // Setup the main connection listener
    setupLocationSockets(io);
    // Capture the callback passed to io.on('connection', ...)
    connectionCallback = (io.on as jest.Mock).mock.calls[0][1];
    // Simulate a client connecting
    connectionCallback(socket);
  });

  // Helper to get a specific event handler from the mock socket
  const getEventHandler = (eventName: string) => {
    const call = (socket.on as jest.Mock).mock.calls.find(c => c[0] === eventName);
    return call ? call[1] : null;
  };

  describe('on:joinRideLocationRoom', () => {
    const rideId = new mongoose.Types.ObjectId().toString();
    const driverId = new mongoose.Types.ObjectId();

    it('should allow a driver to join a room for an in-progress ride', async () => {
      const mockRide = { _id: rideId, driver: { _id: driverId }, status: RideStatus.InProgress, passengers: [] };
      mockedRideModel.findById.mockResolvedValue(mockRide as any);
      socket.userId = driverId.toString();

      const handler = getEventHandler('joinRideLocationRoom');
      await handler(rideId);

      expect(socket.join).toHaveBeenCalledWith(`ride-location-${rideId}`);
      expect(socket.emit).toHaveBeenCalledWith('joinedRideLocationRoom', expect.any(String));
    });

    it('should emit an error if the ride is not in progress', async () => {
      const mockRide = { _id: rideId, driver: { _id: driverId }, status: RideStatus.Scheduled, passengers: [] };
      mockedRideModel.findById.mockResolvedValue(mockRide as any);
      socket.userId = driverId.toString();

      const handler = getEventHandler('joinRideLocationRoom');
      await handler(rideId);

      expect(socket.join).not.toHaveBeenCalled();
      expect(socket.emit).toHaveBeenCalledWith('locationError', expect.stringContaining('não está em andamento'));
    });

    it('should emit an error if the user is not part of the ride', async () => {
      const mockRide = { _id: rideId, driver: { _id: driverId }, status: RideStatus.InProgress, passengers: [] };
      mockedRideModel.findById.mockResolvedValue(mockRide as any);
      socket.userId = new mongoose.Types.ObjectId().toString(); // Different user

      const handler = getEventHandler('joinRideLocationRoom');
      await handler(rideId);

      expect(socket.join).not.toHaveBeenCalled();
      expect(socket.emit).toHaveBeenCalledWith('locationError', expect.stringContaining('não tem permissão'));
    });
  });

  describe('on:updateLocation', () => {
    const rideId = new mongoose.Types.ObjectId();
    const roomName = `ride-location-${rideId}`;

    it('should broadcast location to other non-blocked users in the room', async () => {
      socket.rooms.add(roomName);
      const mockRide = { _id: rideId, driver: { _id: new mongoose.Types.ObjectId() } };
      mockedRideModel.findById.mockResolvedValue(mockRide as any);
      mockedBlockModel.findOne.mockResolvedValue(null); // No block

      const targetSocket = { id: 'socket2', emit: jest.fn(), userId: new mongoose.Types.ObjectId().toString() };
      (io.in(roomName).fetchSockets as jest.Mock).mockResolvedValue([targetSocket]);

      const handler = getEventHandler('updateLocation');
      await handler({ rideId, lat: 10, lng: 20 });

      expect(locationService.broadcastLocationUpdate).toHaveBeenCalled();
      expect(targetSocket.emit).toHaveBeenCalledWith('locationUpdate', expect.any(Object));
    });

    it('should not broadcast to a blocked user', async () => {
      socket.rooms.add(roomName);
      const mockRide = { _id: rideId, driver: { _id: new mongoose.Types.ObjectId() } };
      mockedRideModel.findById.mockResolvedValue(mockRide as any);
      mockedBlockModel.findOne.mockResolvedValue({} as any); // Block exists

      const targetSocket = { id: 'socket2', emit: jest.fn(), userId: new mongoose.Types.ObjectId().toString() };
      (io.in(roomName).fetchSockets as jest.Mock).mockResolvedValue([targetSocket]);

      const handler = getEventHandler('updateLocation');
      await handler({ rideId, lat: 10, lng: 20 });

      expect(targetSocket.emit).not.toHaveBeenCalled();
    });
  });
});
