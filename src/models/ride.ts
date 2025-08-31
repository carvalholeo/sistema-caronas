import { Schema, model, Document, Types } from 'mongoose';

import { Location, PassengerStatus, RidePassenger } from '../types';
import { VehicleStatus } from './vehicle';

export enum RideStatus {
  Scheduled = 'scheduled',
  InProgress = 'in_progress',
  Completed = 'completed',
  Cancelled = 'cancelled',
}

interface AuditLog {
  action: string;
  adminUser?: Types.ObjectId;
  timestamp?: Date;
  reason?: string;
  details?: any;
}


// Subdocumento de auditoria
const AuditLogSchema = new Schema<AuditLog>({
  action: { type: String, required: true },
  adminUser: { type: Schema.Types.ObjectId, ref: 'User' },
  timestamp: { type: Date, default: Date.now, immutable: true },
  reason: { type: String },
  details: { type: Schema.Types.Mixed },
});

const PointSchema = new Schema<Location>({
  type: { type: String, enum: ['Point'], required: true },
  coordinates: {
    type: [Number],
    required: true,
    validate: {
      validator: function(coords: number[]) {
        return coords.length === 2 &&
               coords[0] >= -180 && coords[0] <= 180 && // longitude
               coords[1] >= -90 && coords[1] <= 90;     // latitude
      },
      message: 'Coordinates must be [longitude, latitude] with valid ranges'
    }
  },
  address: { type: String },
}, { _id: false });

const PassengerSchema = new Schema<RidePassenger>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: Object.values(PassengerStatus), default: PassengerStatus.Pending },
  requestedAt: { type: Date, default: Date.now },
  managedAt: { type: Date },
});

export interface IRide extends Document {
  driver: Types.ObjectId;
  vehicle: Types.ObjectId;
  origin: { type: string; coordinates: [number, number] };
  destination: { type: string; coordinates: [number, number] };
  intermediateStops: { location: string; point: object }[];
  departureTime: Date;
  availableSeats: number;
  price: number;
  status: RideStatus;
  passengers: {
    user: Types.ObjectId;
    status: PassengerStatus;
    requestedAt: Date;
    managedAt?: Date;
  }[];
  isRecurrent: boolean;
  recurrenceId?: string;
  auditHistory: AuditLog[];
  distanceKm?: number;
  createdAt: Date;
  updatedAt: Date;
  canceledAt?: Date;
  cancelReason?: string;
}

const RideSchema = new Schema<IRide>({
  driver: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  vehicle: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },
  origin: { location: { type: String }, point: { type: PointSchema, required: true } },
  destination: { location: { type: String }, point: { type: PointSchema, required: true } },
  intermediateStops: [{ location: { type: String }, point: { type: PointSchema } }],
  departureTime: { type: Date, required: true, validate: {
      validator: function(date: Date) {
        return date > new Date();
      },
      message: 'Departure time must be in the future'
    }
  },
  availableSeats: { type: Number, required: true, min: 0, max: 7 },
  price: { type: Number, required: true, min: 0 },
  status: { type: String, enum: Object.values(RideStatus), default: RideStatus.Scheduled },
  passengers: [PassengerSchema],
  isRecurrent: { type: Boolean, default: false },
  recurrenceId: { type: String, index: true },
  auditHistory: [AuditLogSchema],
  distanceKm: { type: Number },
  canceledAt: { type: Date },
  cancelReason: { type: String }
}, { timestamps: true });

RideSchema.index({ 'origin.point': '2dsphere', 'destination.point': '2dsphere', departureTime: 1 });
RideSchema.index({ driver: 1 });
RideSchema.index({ 'passengers.user': 1 });
RideSchema.index({ status: 1 });

RideSchema.pre<IRide>('save', function(next) {
  this.updatedAt = new Date();
  next();
});

RideSchema.pre<IRide>('save', async function(next) {
  if (this.isNew || this.isModified('vehicle')) {
    const Vehicle = model('Vehicle');
    const vehicle = await Vehicle.findById(this.vehicle);

    if (!vehicle) {
      return next(new Error('Vehicle not found'));
    }

    if (vehicle.status !== VehicleStatus.Active) {
      return next(new Error('Vehicle must be active and approved to create rides'));
    }

    if (vehicle.owner.toString() !== this.driver.toString()) {
      return next(new Error('Driver must own the vehicle'));
    }
  }

  next();
});

RideSchema.methods.canBeCancelled = function(): boolean {
  const now = new Date();
  const departureTime = new Date(this.departureTime);
  const timeDifference = departureTime.getTime() - now.getTime();
  const hoursUntilDeparture = timeDifference / (1000 * 60 * 60);

  return hoursUntilDeparture >= 1 && this.status !== RideStatus.Cancelled;
};

export const RideModel = model<IRide>('Ride', RideSchema);
