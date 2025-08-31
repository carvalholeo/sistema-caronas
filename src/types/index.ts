import {Types} from 'mongoose';
// src/types/index.ts

export interface User {
    id: string;
    username: string;
    email: string;
    passwordHash: string;
    role: 'passenger' | 'driver' | 'moderator' | 'admin';
    createdAt: Date;
    updatedAt: Date;
}

export interface Ride {
    id: string;
    driverId: string;
    passengerIds: string[];
    vehicleId: string;
    startLocation: string;
    endLocation: string;
    startTime: Date;
    endTime: Date;
    status: 'scheduled' | 'in_progress' | 'completed' | 'canceled';
    createdAt: Date;
    updatedAt: Date;
}

export interface Vehicle {
    id: string;
    ownerId: string;
    licensePlate: string;
    model: string;
    year: number;
    capacity: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface ChatMessage {
    id: string;
    senderId: string;
    recipientId: string;
    content: string;
    timestamp: Date;
}

export interface Notification {
    id: string;
    userId: string;
    message: string;
    isRead: boolean;
    createdAt: Date;
}

export interface AuditLog {
    id: string;
    action: string;
    userId: string;
    timestamp: Date;
    details: string;
}

export interface Location {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
  address?: string;
}

export enum PassengerStatus {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
  Cancelled = 'cancelled',
}

export interface RidePassenger {
  user: Types.ObjectId;
  status: PassengerStatus;
  requestedAt: Date;
  managedAt?: Date;
}