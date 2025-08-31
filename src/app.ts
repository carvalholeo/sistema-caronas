import { createServer, Server as HttpServer } from 'http';

import express from 'express';
import mongoose from 'mongoose';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import cors from 'cors';
import compression from 'compression';

import { Server } from 'socket.io';
import { createClient } from 'redis';
import { config } from 'dotenv';


import logger from './utils/logger';

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import rideRoutes from './routes/rides';
import vehicleRoutes from './routes/vehicles';
import chatRoutes from './routes/chat';
import notificationRoutes from './routes/notifications';
import adminRoutes from './routes/admin';
import publicRoutes from './routes/public';
import { errorHandler } from './middlewares/errorHandler';
import auditLogger from './middlewares/auditLogger';
import { setupLocationSockets } from 'socket/locationSocket';
import { initializeChatSockets } from 'socket/chatSocket';

config();

class CarpoolApp {
  public app: express.Application;
  public server: HttpServer;
  public io: Server;
  private redisClient: any;
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
    this.initializeSocketIO();
    this.initializeErrorHandling();
  }

  private async initializeDatabase(): Promise<void> {
    try {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/carpool';
      await mongoose.connect(mongoUri);
      logger.info('Connected to MongoDB successfully');
    } catch (error) {
      logger.error('MongoDB connection failed:', error);
      process.exit(1);
    }
  }

  private async initializeRedis(): Promise<void> {
    try {
      const redisUri = process.env.REDIS_URI || 'redis://localhost:6379';
      this.redisClient = createClient({ url: redisUri });
      await this.redisClient.connect();
      logger.info('Connected to Redis successfully');
    } catch (error) {
      logger.error('Redis connection failed:', error);
      process.exit(1);
    }
  }

  private initializeMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));

    // CORS configuration
    this.app.use(cors({
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-two-factor-token']
    }));

    // Compression
    this.app.use(compression());

    // Body parsers
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    this.app.use(auditLogger);

    // Rate limiting - Global
    const globalLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use(globalLimiter);

    // Slow down middleware
    const speedLimiter = slowDown({
      windowMs: 15 * 60 * 1000, // 15 minutes
      delayAfter: 50, // allow 50 requests per 15 minutes without delay
      delayMs: 500 // add 500ms delay per request after delayAfter
    });
    this.app.use(speedLimiter);

    // Login rate limiter
    const loginLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // limit each IP to 5 login attempts per windowMs
      skipSuccessfulRequests: true,
      message: 'Too many login attempts, please try again later.',
    });
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
    const port = process.env.PORT || 3001;
    this.server.listen(port, () => {
      logger.info(`Server is running on port ${port}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
    });
  }

  private async close(): Promise<void> {
    await mongoose.connection.close();
    await this.redisClient.quit();
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
