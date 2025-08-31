// Lógica de tempo real para o chat usando Socket.IO.
import { Server } from 'socket.io';

import { verifyToken } from 'utils/security';
import logger from 'utils/logger';
import { locationService } from 'services/locationService';

export const initializeChatSockets = (io: Server) => {
    io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          throw new Error('No token provided');
        }

        // Verify JWT token (implement in auth service)
        const decoded = await verifyToken(token);
        socket.userId = decoded.userId;
        socket.sessionId = decoded.sessionId;
        next();
      } catch (error) {
        next(new Error('Authentication error'));
      }
    });

    io.on('connection', (socket) => {
      logger.info(`User ${socket.userId} connected with session ${socket.sessionId}`);

      // Join user to their personal room
      socket.join(`user:${socket.userId}`);

      // Location sharing
      socket.on('share_location', (data) => {
        locationService.validateUserForLocationRoom(socket.userId!, data);
      });

      // Chat events
      socket.on('join_chat', (rideId) => {
        socket.join(`ride:${rideId}`);
      });

      socket.on('leave_chat', (rideId) => {
        socket.leave(`ride:${rideId}`);
      });

      socket.on('typing', (data) => {
        socket.to(`ride:${data.rideId}`).emit('user_typing', {
          userId: socket.userId,
          isTyping: data.isTyping
        });
      });

      socket.on('disconnect', () => {
        logger.info(`User ${socket.userId} disconnected`);
        locationService.removeUserLocation(socket);
      });
    });
};
