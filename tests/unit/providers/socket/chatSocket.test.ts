import { Server, Socket } from 'socket.io';
import { initializeChatSockets } from '../../../../src/providers/socket/chatSocket';
import { verifyToken } from '../../../../src/utils/security';
import logger from '../../../../src/utils/logger';
import { locationService } from '../../../../src/services/locationService';

// Mock dependencies
jest.mock('../../../../src/utils/security');
jest.mock('../../../../src/utils/logger');
jest.mock('../../../../src/services/locationService');

const mockedVerifyToken = verifyToken as jest.Mock;
const mockedLogger = logger as jest.Mocked<typeof logger>;
const mockedLocationService = locationService as jest.Mocked<typeof locationService>;

describe('Chat Socket Provider', () => {
  let io: Server;
  let socket: Socket;
  let next: jest.Mock;

  beforeEach(() => {
    // Mock io and socket objects
    io = {
      use: jest.fn(),
      on: jest.fn(),
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    } as unknown as Server;

    socket = {
      handshake: { auth: {} },
      on: jest.fn(),
      emit: jest.fn(),
      join: jest.fn(),
      leave: jest.fn(),
      to: jest.fn().mockReturnThis(),
      userId: '',
      sessionId: '',
    } as unknown as Socket;

    next = jest.fn();
    jest.clearAllMocks();

    // Initialize sockets to set up middleware and connection listener
    initializeChatSockets(io);
  });

  describe('Authentication Middleware (io.use)', () => {
    let authMiddleware: (socket: Socket, next: jest.Mock) => void;

    beforeEach(() => {
      // Extract the middleware function passed to io.use
      authMiddleware = (io.use as jest.Mock).mock.calls[0][0];
    });

    it('should call next with an error if no token is provided', async () => {
      socket.handshake.auth = {};
      await authMiddleware(socket, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(next.mock.calls[0][0].message).toContain('No token provided');
    });

    it('should call next with an error if token is invalid', async () => {
      socket.handshake.auth = { token: 'invalid-token' };
      mockedVerifyToken.mockRejectedValue(new Error('Token verification failed'));
      await authMiddleware(socket, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(next.mock.calls[0][0].message).toContain('Authentication error');
    });

    it('should set userId and sessionId on socket and call next on successful authentication', async () => {
      socket.handshake.auth = { token: 'valid-token' };
      mockedVerifyToken.mockResolvedValue({ userId: 'user123', sessionId: 'session456' });
      await authMiddleware(socket, next);
      expect(socket.userId).toBe('user123');
      expect(socket.sessionId).toBe('session456');
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('Connection Event (io.on("connection"))', () => {
    let connectionHandler: (socket: Socket) => void;

    beforeEach(() => {
      // Extract the connection handler passed to io.on('connection', ...)
      connectionHandler = (io.on as jest.Mock).mock.calls[0][1];
      // Simulate a successful authentication for the connection handler
      socket.userId = 'user123';
      socket.sessionId = 'session456';
      connectionHandler(socket);
    });

    it('should log user connection and join personal room', () => {
      expect(mockedLogger.info).toHaveBeenCalledWith(`User ${socket.userId} connected with session ${socket.sessionId}`);
      expect(socket.join).toHaveBeenCalledWith(`user:${socket.userId}`);
    });

    it('should handle share_location event', () => {
      const shareLocationHandler = (socket.on as jest.Mock).mock.calls.find(call => call[0] === 'share_location')[1];
      const data = { lat: 10, lng: 20 };
      shareLocationHandler(data);
      expect(mockedLocationService.validateUserForLocationRoom).toHaveBeenCalledWith(socket.userId, data);
    });

    it('should handle join_chat event', () => {
      const joinChatHandler = (socket.on as jest.Mock).mock.calls.find(call => call[0] === 'join_chat')[1];
      const rideId = 'ride123';
      joinChatHandler(rideId);
      expect(socket.join).toHaveBeenCalledWith(`ride:${rideId}`);
    });

    it('should handle leave_chat event', () => {
      const leaveChatHandler = (socket.on as jest.Mock).mock.calls.find(call => call[0] === 'leave_chat')[1];
      const rideId = 'ride123';
      leaveChatHandler(rideId);
      expect(socket.leave).toHaveBeenCalledWith(`ride:${rideId}`);
    });

    it('should handle typing event', () => {
      const typingHandler = (socket.on as jest.Mock).mock.calls.find(call => call[0] === 'typing')[1];
      const data = { rideId: 'ride123', isTyping: true };
      typingHandler(data);
      expect(socket.to).toHaveBeenCalledWith(`ride:${data.rideId}`);
      expect(socket.emit).toHaveBeenCalledWith('user_typing', { userId: socket.userId, isTyping: data.isTyping });
    });

    it('should handle disconnect event', () => {
      const disconnectHandler = (socket.on as jest.Mock).mock.calls.find(call => call[0] === 'disconnect')[1];
      disconnectHandler();
      expect(mockedLogger.info).toHaveBeenCalledWith(`User ${socket.userId} disconnected`);
      expect(mockedLocationService.removeUserLocation).toHaveBeenCalledWith(socket);
    });
  });
});