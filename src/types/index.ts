import {Types, Document} from 'mongoose';
import { LocationLogAction, MessageStatus, NotificationType, PassengerStatus, RideStatus, UserRole, UserStatus, VehicleStatus } from './enums/enums';
// src/types/index.ts

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  matricula: string;
  password: string;
  roles: UserRole[];
  permissions: string[];
  status: UserStatus;
  twoFactorSecret: string;
  twoFactorEnabled: boolean;
  forcePasswordChangeOnNextLogin: boolean;
  sessionVersion: number;
  auditHistory: IAuditLogSchema[];
  lastLogin?: Date;
  accessibilitySettings: IAccessibilitySettings;
  languagePreference: string;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(password: string): Promise<boolean>;
}

export interface IAccessibilitySettings extends Document {
  highContrast: boolean;
  largeFont: boolean;
  reduceAnimations: boolean;
  muteSounds: boolean;
}

export interface IDataReport extends Document {
  user: Types.ObjectId;
  adminUser: Types.ObjectId;
  hash: Types.UUID;
  includedDataPoints: string[];
  createdAt: Date;
}

export interface IBlock extends Document {
  blockerUser: Types.ObjectId;
  blockedUser: Types.ObjectId;
  reason: string;
  status: 'active' | 'reversed_by_admin';
  auditHistory: IAuditLogSchema[];
  createdAt: Date;
}

export interface IAuditLogSchema extends Document {
  action: string;
  adminUser?: Types.ObjectId;
  timestamp?: Date;
  reason?: string;
  details?: any;
}

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
  auditHistory: IAuditLogSchema[];
  distanceKm?: number;
  createdAt: Date;
  updatedAt: Date;
  canceledAt?: Date;
  cancelReason?: string;
}

export interface IRideViewEvent extends Document {
  user: Types.ObjectId;
  ride: Types.ObjectId;
  searchEventId?: Types.ObjectId;
  timestamp: Date;
}

export interface ISearchEvent extends Document {
  user: Types.ObjectId;
  durationMs: number;
  resultsCount: number;
  timestamp: Date;
}

export interface ISessionEvent extends Document {
  user: Types.ObjectId;
  type: 'refresh_token_rotation' | 'global_logout_admin';
  device?: string;
  ipAddress?: string;
  adminUser?: Types.ObjectId;
  timestamp: Date;
}

export interface IVehicle extends Document {
  owner: Types.ObjectId;
  plate: string;
  make: string;
  carModel: string;
  year: number;
  color: string;
  capacity: number;
  photoUrl?: string;
  status: VehicleStatus;
  auditHistory: IAuditLogSchema[];
  createdAt: Date;
  updatedAt: Date;
}
export interface RidePassenger {
  user: Types.ObjectId;
  status: PassengerStatus;
  requestedAt: Date;
  managedAt?: Date;
}
export interface IChatMessage extends Document {
  ride: Types.ObjectId;
  sender: IUser;
  content: string;
  status: MessageStatus;
  isModerated: boolean;
  deliveredAt?: Date;
  readAt?: Date;
  moderationDetails?: {
    originalContent: string;
    moderatedBy: Types.ObjectId;
    moderatedAt: Date;
    reason: string;
  };
  createdAt: Date;
  updatedAt: Date;
}
export interface INotification extends Document {
  user: Types.ObjectId;
  type: NotificationType,
  title: string;
  content: string;
  data?: string;
  isRead: boolean;
  createdAt: Date;
  expiresAt?: Date;
}

export interface INotificationEvent extends Document {
  subscription: Types.ObjectId;
  category: 'security' | 'rides' | 'communication' | 'critical';
  statusHistory: { status: 'sent' | 'delivered' | 'clicked' | 'failed'; timestamp: Date; details?: string }[];
  isAggregated: boolean;
  isCritical: boolean;
}

export interface INotificationSubscription extends Document {
  user: Types.ObjectId;
  deviceIdentifier: string;
  platform: 'web' | 'ios' | 'android';
  endpoint: string;
  keys: { p256dh: string; auth: string };
  isPermissionGranted: boolean;
  preferences: {
    security: boolean;
    rides: boolean;
    communication: boolean;
  };
}

export interface ISuppressedNotification extends Document {
  user: Types.ObjectId;
  reason: 'rate_limit' | 'aggregation';
}

export interface IPasswordReset extends Document {
  user: Types.ObjectId;
  status: 'initiated' | 'completed';
  initiatedAt: Date;
  completedAt?: Date;
}

export interface IPrivacyRequest extends Document {
  user: Types.ObjectId;
  type: 'access' | 'correction' | 'portability' | 'removal';
  status: 'pending' | 'in_progress' | 'completed' | 'denied';
  requestedAt: Date;
  completedAt?: Date;
  adminUser?: Types.ObjectId;
}

export interface IAuditLog extends Document {
  adminUser: Types.ObjectId;
  action: string;
  target: {
    type: 'user' | 'ride' | 'chat' | 'vehicle' | string;
    id: string;
  };
  details: {
    ipAddress: string;
    userAgent?: string;
    [key: string]: unknown | undefined;
  };
  timestamp: Date;
}

export interface IAccessDenialLog extends Document {
  adminUser: Types.ObjectId;
  requiredPermission: string;
  attemptedAction: string;
  target?: object;
}

export interface ILoginAttempt extends Document {
  user?: Types.ObjectId;
  email: string;
  ipAddress: string;
  device: string;
  wasSuccessful: boolean;
  timestamp: Date;
}

export interface IFormalNotification extends Document {
  user: Types.ObjectId;
  privacyRequest?: Types.ObjectId;
  subject: string;
  sentAt: Date;
  adminUser: Types.ObjectId;
}

export interface Location extends Document {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
  address?: string;
}

export interface ILocationLog extends Document {
  ride: Types.ObjectId;
  user: Types.ObjectId;
  action: LocationLogAction;
  timestamp: Date;
}
