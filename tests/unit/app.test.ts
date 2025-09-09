import { createServer, Server as HttpServer } from 'http';
import express from 'express';
import compression from 'compression';
import { Server } from 'socket.io';
import { config } from 'dotenv';
import logger from '../../src/utils/logger';
import authRoutes from '../../src/routes/auth';
import userRoutes from '../../src/routes/users';
import rideRoutes from '../../src/routes/rides';
import vehicleRoutes from '../../src/routes/vehicles';
import chatRoutes from '../../src/routes/chat';
import notificationRoutes from '../../src/routes/notifications';
import adminRoutes from '../../src/routes/admin';
import publicRoutes from '../../src/routes/public';
import { errorHandler } from '../../src/middlewares/errorHandler';
import auditLogger from '../../src/middlewares/auditLogger';
import { setupLocationSockets } from '../../src/providers/socket/locationSocket';
import { initializeChatSockets } from '../../src/providers/socket/chatSocket';
import { closeDatabaseConnection, connectToDatabase } from '../../src/providers/database/mongoose';
import { idempotencyMiddleware } from '../../src/middlewares/idempotencyMiddleware';
import { closeRedisConnection, connectToRedis, getRedisClient } from '../../src/providers/cache/redis';
import { globalLimiter } from '../../src/middlewares/limiters/globalLimiter';
import { speedLimiter } from '../../src/middlewares/limiters/speedLimiter';
import { loginLimiter } from '../../src/middlewares/limiters/loginLimiter';
import { helmetCSP } from '../../src/middlewares/security/helmetCSP';
import { corsValidation } from '../../src/middlewares/security/corsValidation';
import CarpoolApp from '../../src/app';

// Mock all external dependencies
jest.mock('http');
jest.mock('express', () => {
  const originalExpress = jest.requireActual('express');
  const app = jest.fn(() => ({ ...originalExpress() }));
  Object.assign(app, originalExpress);
  return app;
});
jest.mock('compression');
jest.mock('socket.io');
jest.mock('dotenv');
jest.mock('../../src/utils/logger');
jest.mock('../../src/routes/auth', () => jest.fn());
jest.mock('../../src/routes/users', () => jest.fn());
jest.mock('../../src/routes/rides', () => jest.fn());
jest.mock('../../src/routes/vehicles', () => jest.fn());
jest.mock('../../src/routes/chat', () => jest.fn());
jest.mock('../../src/routes/notifications', () => jest.fn());
jest.mock('../../src/routes/admin', () => jest.fn());
jest.mock('../../src/routes/public', () => jest.fn());
jest.mock('../../src/middlewares/errorHandler', () => ({
  errorHandler: jest.fn(),
}));
jest.mock('../../src/middlewares/auditLogger', () => jest.fn());
jest.mock('../../src/providers/socket/locationSocket');
jest.mock('../../src/providers/socket/chatSocket');
jest.mock('../../src/providers/database/mongoose');
jest.mock('../../src/providers/cache/redis');
jest.mock('../../src/middlewares/idempotencyMiddleware');
jest.mock('../../src/middlewares/limiters/globalLimiter');
jest.mock('../../src/middlewares/limiters/speedLimiter');
jest.mock('../../src/middlewares/limiters/loginLimiter');
jest.mock('../../src/middlewares/security/helmetCSP');
jest.mock('../../src/middlewares/security/corsValidation');

const mockedCreateServer = createServer as jest.Mock;
const mockedExpress = express as jest.MockedFunction<typeof express>;
const mockedCompression = compression as jest.MockedFunction<typeof compression>;
const mockedSocketIoServer = Server as jest.MockedClass<typeof Server>;
const mockedConfig = config as jest.Mock;
const mockedLogger = logger as jest.Mocked<typeof logger>;
const mockedConnectToDatabase = connectToDatabase as jest.Mock;
const mockedCloseDatabaseConnection = closeDatabaseConnection as jest.Mock;
const mockedConnectToRedis = connectToRedis as jest.Mock;
const mockedCloseRedisConnection = closeRedisConnection as jest.Mock;
const mockedGetRedisClient = getRedisClient as jest.Mock;
const mockedSetupLocationSockets = setupLocationSockets as jest.Mock;
const mockedInitializeChatSockets = initializeChatSockets as jest.Mock;

describe('CarpoolApp', () => {
  let appInstance: CarpoolApp;
  let mockApp: any;
  let mockServer: any;
  let mockIoInstance: any;
  let processExitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules(); 
    process.setMaxListeners(Infinity);

    mockApp = {
      use: jest.fn(),
      get: jest.fn(),
    };
    mockedExpress.mockReturnValue(mockApp);

    mockServer = {
      listen: jest.fn(),
      close: jest.fn((cb) => cb && cb()),
    };
    mockedCreateServer.mockReturnValue(mockServer);

    mockIoInstance = {
      on: jest.fn(),
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };
    mockedSocketIoServer.mockImplementation(() => mockIoInstance);

    mockedGetRedisClient.mockReturnValue({ sendCommand: jest.fn() } as any);

    processExitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);

    appInstance = new CarpoolApp();
  });

  afterEach(() => {
    processExitSpy.mockRestore();
  });

  describe('Constructor', () => {
    it('should initialize Express app and HTTP server', () => {
      expect(mockedExpress).toHaveBeenCalledTimes(1);
      expect(mockedCreateServer).toHaveBeenCalledWith(mockApp);
      expect(appInstance.app).toBe(mockApp);
      expect(appInstance.server).toBe(mockServer);
    });

    it('should initialize Socket.IO server with CORS options', () => {
      expect(mockedSocketIoServer).toHaveBeenCalledWith(mockServer, {
        cors: {
          origin: process.env.FRONTEND_URL || "http://localhost:3000",
          methods: ["GET", "POST"]
        }
      });
      expect(appInstance.io).toBe(mockIoInstance);
    });

    it('should call all initialization methods', () => {
      const spyInitializeDatabase = jest.spyOn(CarpoolApp.prototype as any, 'initializeDatabase');
      const spyInitializeRedis = jest.spyOn(CarpoolApp.prototype as any, 'initializeRedis');
      const spyInitializeMiddleware = jest.spyOn(CarpoolApp.prototype as any, 'initializeMiddleware');
      const spyInitializeRoutes = jest.spyOn(CarpoolApp.prototype as any, 'initializeRoutes');
      const spyInitializeErrorHandling = jest.spyOn(CarpoolApp.prototype as any, 'initializeErrorHandling');

      new CarpoolApp();

      expect(spyInitializeDatabase).toHaveBeenCalledTimes(1);
      expect(spyInitializeRedis).toHaveBeenCalledTimes(1);
      expect(spyInitializeMiddleware).toHaveBeenCalledTimes(1);
      expect(spyInitializeRoutes).toHaveBeenCalledTimes(1);
      expect(spyInitializeErrorHandling).toHaveBeenCalledTimes(1);

      spyInitializeDatabase.mockRestore();
      spyInitializeRedis.mockRestore();
      spyInitializeMiddleware.mockRestore();
      spyInitializeRoutes.mockRestore();
      spyInitializeErrorHandling.mockRestore();
    });
  });

  describe('initializeDatabase', () => {
    it('should connect to MongoDB and log success', async () => {
      mockedConnectToDatabase.mockClear();
      mockedConnectToDatabase.mockResolvedValue(true);
      await (appInstance as any).initializeDatabase();
      expect(mockedConnectToDatabase).toHaveBeenCalledTimes(1);
      expect(mockedLogger.info).toHaveBeenCalledWith('Connected to MongoDB successfully');
      expect(mockedLogger.error).not.toHaveBeenCalled();
      expect(process.exit).not.toHaveBeenCalled();
    });

    it('should log error and exit process on MongoDB connection failure', async () => {
      mockedConnectToDatabase.mockClear();
      const error = new Error('DB connection failed');
      mockedConnectToDatabase.mockRejectedValue(error);
      await (appInstance as any).initializeDatabase();
      expect(mockedLogger.error).toHaveBeenCalledWith('MongoDB connection failed:', error);
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('initializeRedis', () => {
    it('should connect to Redis and log success', async () => {
      processExitSpy.mockClear();
      mockedLogger.error.mockClear();
      mockedConnectToRedis.mockClear();
      mockedConnectToRedis.mockResolvedValue(true);
      await (appInstance as any).initializeRedis();
      expect(mockedConnectToRedis).toHaveBeenCalledTimes(1);
      expect(mockedLogger.info).toHaveBeenCalledWith('Connected to Redis successfully');
      expect(mockedLogger.error).not.toHaveBeenCalled();
      expect(process.exit).not.toHaveBeenCalled();
    });

    it('should log error and exit process on Redis connection failure', async () => {
      mockedConnectToRedis.mockClear();
      const error = new Error('Redis connection failed');
      mockedConnectToRedis.mockRejectedValue(error);
      await (appInstance as any).initializeRedis();
      expect(mockedLogger.error).toHaveBeenCalledWith('Redis connection failed:', error);
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('initializeMiddleware', () => {
    it('should apply all necessary middleware', () => {
      (appInstance as any).initializeMiddleware();

      expect(mockApp.use).toHaveBeenCalledWith(helmetCSP);
      expect(mockApp.use).toHaveBeenCalledWith(corsValidation);
      expect(mockApp.use).toHaveBeenCalledWith(mockedCompression());
      expect(mockApp.use).toHaveBeenCalledWith(expect.any(Function));
      expect(mockApp.use).toHaveBeenCalledWith(expect.any(Function));
      expect(mockApp.use).toHaveBeenCalledWith(auditLogger);
      expect(mockApp.use).toHaveBeenCalledWith(globalLimiter);
      expect(mockApp.use).toHaveBeenCalledWith(speedLimiter);
      expect(mockApp.use).toHaveBeenCalledWith('/api/auth/login', loginLimiter);
      expect(mockApp.use).toHaveBeenCalledWith(auditLogger);
    });
  });

  describe('initializeRoutes', () => {
    it('should set up health check and API routes', () => {
      (appInstance as any).initializeRoutes();

      expect(mockApp.get).toHaveBeenCalledWith('/health', expect.any(Function));
      expect(mockApp.use).toHaveBeenCalledWith('/api', idempotencyMiddleware);
      expect(mockApp.use).toHaveBeenCalledWith('/api/public', publicRoutes);
      expect(mockApp.use).toHaveBeenCalledWith('/api/auth', authRoutes);
      expect(mockApp.use).toHaveBeenCalledWith('/api/users', userRoutes);
      expect(mockApp.use).toHaveBeenCalledWith('/api/vehicles', vehicleRoutes);
      expect(mockApp.use).toHaveBeenCalledWith('/api/rides', rideRoutes);
      expect(mockApp.use).toHaveBeenCalledWith('/api/chat', chatRoutes);
      expect(mockApp.use).toHaveBeenCalledWith('/api/notifications', notificationRoutes);
      expect(mockApp.use).toHaveBeenCalledWith('/api/admin', adminRoutes);
      expect(mockApp.use).toHaveBeenCalledWith('*', expect.any(Function)); // 404 handler
    });

    it('health check should return 503 when shutting down', () => {
        (appInstance as any).isShuttingDown = true;
        (appInstance as any).initializeRoutes();
        const healthCheckHandler = mockApp.get.mock.calls.find((call: any) => call[0] === '/health')[1];
        const mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        healthCheckHandler({}, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(503);
        expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'shuttind down the server' }));
    });

    it('health check should return 200 when not shutting down', () => {
        (appInstance as any).isShuttingDown = false;
        (appInstance as any).initializeRoutes();
        const healthCheckHandler = mockApp.get.mock.calls.find((call: any) => call[0] === '/health')[1];
        const mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        healthCheckHandler({}, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'ok' }));
    });
  });

  describe('initializeSocketIO', () => {
    it('should re-instantiate Socket.IO server and set up socket handlers', () => {
      mockedSocketIoServer.mockClear();
      (appInstance as any).initializeSocketIO();
      expect(mockedSocketIoServer).toHaveBeenCalledTimes(1); 
      expect(mockedSocketIoServer).toHaveBeenCalledWith(mockServer);
      expect(mockedSetupLocationSockets).toHaveBeenCalledWith(mockIoInstance);
      expect(mockedInitializeChatSockets).toHaveBeenCalledWith(mockIoInstance);
    });
  });

  describe('initializeErrorHandling', () => {
    let onSpy: jest.SpyInstance;
    let uncaughtExceptionHandler: (error: Error) => void;
    let unhandledRejectionHandler: (error: Error) => void;

    beforeEach(() => {
        onSpy = jest.spyOn(process, 'on').mockImplementation((event, listener) => {
            if (event === 'uncaughtException') {
                uncaughtExceptionHandler = listener as any;
            }
            if (event === 'unhandledRejection') {
                unhandledRejectionHandler = listener as any;
            }
            return process;
        });
        (appInstance as any).initializeErrorHandling();
    });

    afterEach(() => {
        onSpy.mockRestore();
    });

    it('should apply error handler middleware and set up process event listeners', () => {
        expect(mockApp.use).toHaveBeenCalledWith(errorHandler);
        expect(process.on).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
        expect(process.on).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
    });

    it('uncaughtException handler should log error and shutdown', () => {
        const error = new Error('Test Uncaught Exception');
        const spyShutdown = jest.spyOn(appInstance, 'shutdown').mockResolvedValue(undefined);

        uncaughtExceptionHandler(error);

        expect((appInstance as any)['isShuttingDown']).toBe(true);
        expect(mockedLogger.error).toHaveBeenCalledWith('Uncaught Exception:', error);
        expect(spyShutdown).toHaveBeenCalledWith(1);
    });

    it('unhandledRejection handler should log error and shutdown', () => {
        const error = new Error('Test Unhandled Rejection');
        const spyShutdown = jest.spyOn(appInstance, 'shutdown').mockResolvedValue(undefined);

        unhandledRejectionHandler(error);

        expect((appInstance as any)['isShuttingDown']).toBe(true);
        expect(mockedLogger.error).toHaveBeenCalledWith('Unhandled Rejection:', error);
        expect(spyShutdown).toHaveBeenCalledWith(1);
    });
  });
});

describe('CarpoolApp Lifecycle', () => {
  let appInstance: CarpoolApp;
  let mockServer: any;
  let processExitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules(); 

    mockServer = {
      listen: jest.fn((port, cb) => cb && cb()),
      close: jest.fn((cb) => cb && cb()),
    };
    mockedCreateServer.mockReturnValue(mockServer);

    processExitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);

    appInstance = new CarpoolApp();
  });

  afterEach(() => {
    processExitSpy.mockRestore();
  });

  describe('listen', () => {
    it('should start the server on the specified port', () => {
      appInstance.listen();
      expect(mockServer.listen).toHaveBeenCalledWith(3001, expect.any(Function));
      expect(mockedLogger.info).toHaveBeenCalledWith('Server is running on port 3001');
      expect(mockedLogger.info).toHaveBeenCalledWith(`Environment: ${process.env.NODE_ENV}`);
    });

    it('should use process.env.PORT if available', () => {
      process.env.PORT = '8080';
      appInstance.listen();
      expect(mockServer.listen).toHaveBeenCalledWith('8080', expect.any(Function));
      expect(mockedLogger.info).toHaveBeenCalledWith('Server is running on port 8080');
    });
  });

  describe('shutdown', () => {
    it('should perform a graceful shutdown', async () => {
      mockedCloseDatabaseConnection.mockResolvedValue(true);
      mockedCloseRedisConnection.mockResolvedValue(true);

      await appInstance.shutdown(0);

      expect(mockedLogger.info).toHaveBeenCalledWith('Starting graceful shutdown (code 0)...');
      expect(mockedCloseDatabaseConnection).toHaveBeenCalledTimes(1);
      expect(mockedCloseRedisConnection).toHaveBeenCalledTimes(1);
      expect(mockServer.close).toHaveBeenCalledTimes(1);
      expect(mockedLogger.info).toHaveBeenCalledWith('Application closed cleanly.');
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('should handle shutdown timeout', async () => {
      mockedCloseDatabaseConnection.mockReturnValue(new Promise(resolve => setTimeout(resolve, 200)));
      mockedCloseRedisConnection.mockResolvedValue(true);

      await appInstance.shutdown(0, 100);

      expect(mockedLogger.error).toHaveBeenCalledWith('Error during shutdown:', expect.any(Error));
      expect(process.exit).toHaveBeenCalledWith(255);
    });

    it('should handle errors during close', async () => {
      const error = new Error('DB close failed');
      mockedCloseDatabaseConnection.mockRejectedValue(error);
      mockedCloseRedisConnection.mockResolvedValue(true);

      await appInstance.shutdown(0);

      expect(mockedLogger.error).toHaveBeenCalledWith('Error during shutdown:', error);
      expect(process.exit).toHaveBeenCalledWith(255);
    });
  });

  describe('reload', () => {
    it('should close and restart the application', async () => {
      mockedCloseDatabaseConnection.mockResolvedValue(true);
      mockedCloseRedisConnection.mockResolvedValue(true);
      const listenSpy = jest.spyOn(appInstance, 'listen');

      await appInstance.reload();

      expect(mockedLogger.info).toHaveBeenCalledWith('Reloading application...');
      expect(mockedCloseDatabaseConnection).toHaveBeenCalledTimes(1);
      expect(mockedCloseRedisConnection).toHaveBeenCalledTimes(1);
      expect(mockServer.close).toHaveBeenCalledTimes(1);
      expect(listenSpy).toHaveBeenCalledTimes(1);
      expect(mockedLogger.info).toHaveBeenCalledWith('Reload finished successfully.');
      expect(appInstance['isReloading']).toBe(false);
    });

    it('should handle errors during reload and keep the old instance running', async () => {
      const error = new Error('Reload failed');
      mockedCloseDatabaseConnection.mockRejectedValue(error);
      const listenSpy = jest.spyOn(appInstance, 'listen');

      await appInstance.reload();

      expect(mockedLogger.error).toHaveBeenCalledWith('Error during reload:', error);
      expect(mockedLogger.warn).toHaveBeenCalledWith('Reload failed. Keeping the previous instance running.');
      expect(listenSpy).not.toHaveBeenCalled();
      expect(appInstance['isReloading']).toBe(false);
    });

    it('should prevent concurrent reloads', async () => {
      appInstance['isReloading'] = true;
      const closeSpy = jest.spyOn(appInstance as any, 'close');

      await appInstance.reload();

      expect(mockedLogger.warn).toHaveBeenCalledWith('Reload already in progress. Ignoring new request.');
      expect(closeSpy).not.toHaveBeenCalled();
    });
  });
});