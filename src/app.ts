import { createServer, Server as HttpServer } from 'http';

import express from 'express';
import compression from 'compression';

import { Server } from 'socket.io';

import { config } from 'dotenv';

import logger from './utils/logger';

import authRoutes from 'routes/auth';
import userRoutes from 'routes/users';
import rideRoutes from 'routes/rides';
import vehicleRoutes from 'routes/vehicles';
import chatRoutes from 'routes/chat';
import notificationRoutes from 'routes/notifications';
import adminRoutes from 'routes/admin';
import publicRoutes from 'routes/public';
import { errorHandler } from 'middlewares/errorHandler';
import auditLogger from 'middlewares/auditLogger';
import { setupLocationSockets } from 'providers/socket/locationSocket';
import { initializeChatSockets } from 'providers/socket/chatSocket';
import { closeDatabaseConnection, connectToDatabase } from 'providers/database/mongoose';
import { idempotencyMiddleware } from 'middlewares/idempotencyMiddleware';
import { closeRedisConnection, connectToRedis } from 'providers/cache/redis';
import { globalLimiter } from 'middlewares/limiters/globalLimiter';
import { speedLimiter } from 'middlewares/limiters/speedLimiter';
import { loginLimiter } from 'middlewares/limiters/loginLimiter';
import { helmetCSP } from 'middlewares/security/helmetCSP';
import { corsValidation } from 'middlewares/security/corsValidation';

config();

class CarpoolApp {
  public app: express.Application;
  public server: HttpServer;
  public io: Server;
  private isShuttingDown: boolean = false;
  private isReloading = false;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new Server(this.server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"]
      }
    });

    this.initializeDatabase();
    this.initializeRedis();
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private async initializeDatabase(): Promise<void> {
    try {
      await connectToDatabase();
      logger.info('Connected to MongoDB successfully');
    } catch (error) {
      logger.error('MongoDB connection failed:', error);
      process.exit(1);
    }
  }

  private async initializeRedis(): Promise<void> {
    try {
      await connectToRedis();
      logger.info('Connected to Redis successfully');
    } catch (error) {
      logger.error('Redis connection failed:', error);
      process.exit(1);
    }
  }

  private initializeMiddleware(): void {
    // Security middleware
    this.app.use(helmetCSP);

    // CORS configuration
    this.app.use(corsValidation);

    // Compression
    this.app.use(compression());

    // Body parsers
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    this.app.use(auditLogger);

    // Rate limiting - Global
    this.app.use(globalLimiter);

    // Slow down middleware
    this.app.use(speedLimiter);

    // Login rate limiter
    this.app.use('/api/auth/login', loginLimiter);

    // Audit logging
    this.app.use(auditLogger);
  }

  private initializeRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      if (this.isShuttingDown) {
        res.status(503).json({
          status: 'shuttind down the server',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          environment: process.env.NODE_ENV
        });
      }
      res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV
      });
    });

    // API routes
    this.app.use('/api', idempotencyMiddleware);
    this.app.use('/api/public', publicRoutes);
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/users', userRoutes);
    this.app.use('/api/vehicles', vehicleRoutes);
    this.app.use('/api/rides', rideRoutes);
    this.app.use('/api/chat', chatRoutes);
    this.app.use('/api/notifications', notificationRoutes);
    this.app.use('/api/admin', adminRoutes);

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({ error: 'Route not found' });
    });
  }

  private initializeSocketIO(): void {
    // Socket.IO authentication middleware
    this.io = new Server(this.server);
    setupLocationSockets(this.io);
    initializeChatSockets(this.io);
  }

  private initializeErrorHandling(): void {
    this.app.use(errorHandler);

    // Global error handlers
    process.on('uncaughtException', (error) => {
      this.isShuttingDown = true;
      logger.error('Uncaught Exception:', error);
      this.shutdown(1);
    });

    process.on('unhandledRejection', (error) => {
      this.isShuttingDown = true;
      logger.error('Unhandled Rejection:', error);
      this.shutdown(1);
    });
  }

  public listen(): void {
    this.isShuttingDown = false;
    this.initializeSocketIO();
    const port = process.env.PORT || 3001;
    this.server.listen(port, () => {
      logger.info(`Server is running on port ${port}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
    });
  }

  private async close(): Promise<void> {
    await closeDatabaseConnection();
    await closeRedisConnection();
    this.server.close();
  }

  public async shutdown(code = 0, timeout = 10000): Promise<void> {
    logger.info(`Starting graceful shutdown (code ${code})...`);
    this.isShuttingDown = true;

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Shutdown timeout after ${timeout}ms`)), timeout);
    });

    try {
      await Promise.race([this.close(), timeoutPromise]);
      logger.info('Application closed cleanly.');
    } catch (err) {
      logger.error('Error during shutdown:', err);
      code = 255;
    } finally {
      process.exit(code);
    }
  }

  public async reload(): Promise<void> {
    if (this.isReloading) {
      logger.warn('Reload already in progress. Ignoring new request.');
      return;
    }

    this.isReloading = true;
    logger.info('Reloading application...');

    try {
      await this.close();
      this.listen();
      logger.info('Reload finished successfully.');
    } catch (err) {
      logger.error('Error during reload:', err);
      logger.warn('Reload failed. Keeping the previous instance running.');
    } finally {
      this.isReloading = false;
    }
  }
}

export default CarpoolApp;
