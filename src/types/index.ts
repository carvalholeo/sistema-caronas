import { Types, Document } from 'mongoose';
import { AuditActionType, AuditLogCategory, AuditLogSeverityLevels, BlockStatus, LocationLogAction, MessageStatus, NotificationCategory, NotificationType, NotificationWeekDays, PassengerStatus, PasswordResetStatus, PrivacyRequestStatus, PrivacyRequestType, RideStatus, UserRole, UserStatus, VehicleStatus } from './enums/enums';
import { EventKind, NotificationEventCategory, NotificationStatusHistory } from './types/events';
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
  status: BlockStatus;
  createdAt: Date;
}

export interface IAuditLog extends Document {
  actor: {
    userId: Types.ObjectId;
    isAdmin: boolean;
    ip: string;
    userAgent?: string;
  };
  action: {
    actionType: AuditActionType;
    category: AuditLogCategory;
    detail?: string;
  };
  target: {
    resourceType: string;
    resourceId: Types.ObjectId;
    beforeState?: any;
    afterState?: any;
  };
  metadata: {
    severity: AuditLogSeverityLevels;
    relatedResources?: Array<{
      type: string;
      id: Types.ObjectId;
    }>;
    [key: string]: any;
  };
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
  distanceKm?: number;
  createdAt: Date;
  updatedAt: Date;
  canceledAt?: Date;
  cancelReason?: string;
}

export interface IRideViewEvent extends IEventBase {
  kind: 'ride_view';
  user: Types.ObjectId;
  ride: Types.ObjectId;
  searchEventId?: Types.ObjectId;
}

export interface ISearchEvent extends IEventBase {
  kind: 'search';
  user: Types.ObjectId;
  durationMs: number;
  resultsCount: number;
}

export interface INotificationEvent extends IEventBase {
  kind: 'notification';
  subscription: Types.ObjectId;
  category: NotificationEventCategory;
  statusHistory: Array<{ status: NotificationStatusHistory; timestamp: Date; details?: string }>;
  isAggregated: boolean;
  isCritical: boolean;
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
  createdAt: Date;
  updatedAt: Date;
}

export interface RidePassenger extends Document {
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

export interface INotificationPayload {
  category: NotificationCategory;
  title: string;
  body: string;
  url?: string; // URL para abrir ao clicar na notificação
  icon?: string;
  badge?: string;
}

export interface INotificationKind {
  security: boolean;
  rides: boolean;
  chats: boolean;
  communication: boolean;
  system: boolean;
}

export interface INotificationSubscription extends Document {
  user: Types.ObjectId;
  deviceIdentifier: string;
  platform: 'web' | 'ios' | 'android' | 'email';
  endpoint: string;
  keys: { p256dh: string; auth: string };
  destination: string;
  isPermissionGranted: boolean;
  notificationsKinds: INotificationKind;
  preferences: INotificationPreferences | undefined;
}

export interface IUpdatePreferencesData {
  kinds?: {
    security?: boolean;
    rides?: boolean;
    chats?: boolean;
    communication?: boolean;
    system?: boolean;
  };
  quietHours?: {
    startHour: number;
    endHour: number;
    weekDays: NotificationWeekDays[];
    timezone: string;
  } | null;
}

export interface INotificationPreferences extends INotificationTime {
  maskToDays(mask: number): NotificationWeekDays[];
  daysToMask(days: NotificationWeekDays[]): number;
  convertHourFromDatabase(p: INotificationTime): INotificationTime;
  convertHourToDatabase(timeObject: INotificationTime): INotificationTime;
}

export interface INotificationTime {
  startMinute: number;
  endMinute: number;
  timezone: string;
  weekMask: NotificationWeekDays;
}

export interface ISuppressedNotification extends Document {
  user: Types.ObjectId;
  reason: 'rate_limit' | 'aggregation';
}

export interface IPasswordReset extends Document {
  user: Types.ObjectId;
  status: PasswordResetStatus;
  initiatedAt: Date;
  completedAt?: Date;
}

export interface IPrivacyRequest extends Document {
  user: Types.ObjectId;
  type: PrivacyRequestType;
  status: PrivacyRequestStatus;
  requestedAt: Date;
  completedAt?: Date;
  adminUser?: Types.ObjectId;
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

export interface IEventBase extends Document {
  _id: Types.ObjectId;
  kind: EventKind;
  user?: Types.ObjectId | null;
}