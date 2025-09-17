import cors, { CorsRequest } from 'cors';
import { NextFunction } from 'express';

interface CorsResponse {
  statusCode?: number | undefined;
  setHeader(key: string, value: string): any;
  end(): any;
}
export function corsValidation() {
  const options: cors.CorsOptions = {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'two-factor-token']
  };

  return cors(options);
}

