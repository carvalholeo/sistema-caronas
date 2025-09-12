import { Types, Document } from 'mongoose';
import { AuditActionType, AuditLogCategory, AuditLogSeverityLevels, BlockStatus, LocationLogAction, MessageStatus, NotificationScope, NotificationType, NotificationWeekDays, PassengerStatus, PasswordResetStatus, PrivacyRequestStatus, PrivacyRequestType, RideStatus, UserRole, UserStatus, VehicleStatus } from 'types/enums/enums';
import { EventKind, NotificationEventCategory, NotificationStatusHistory } from 'types/types/events';
// src/types/index.ts

export interface IUser extends Document {
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
  profilePictureUrl?: string;
  comparePassword(password: string): Promise<boolean>;
  isTemporaryEmail(email: string): boolean;
}

export interface IAccessibilitySettings extends Document {
  highContrast: boolean;
  largeFont: boolean;
  reduceAnimations: boolean;
  muteSounds: boolean;
}

export interface IDataReport extends Document {
  user: IUser;
  adminUser: IUser;
  hash: Types.UUID;
  includedDataPoints: string[];
  createdAt: Date;
}

export interface IBlock extends Document {
  blockerUser: IUser;
  blockedUser: IUser;
  reason: string;
  status: BlockStatus;
  createdAt: Date;
}

export interface IAuditLog extends Document {
  actor: {
    userId: Types.ObjectId | IUser;
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
  createdAt: Date;
}

export interface IRide extends Document {
  driver: IUser;
  vehicle: IVehicle;
  origin: { type: string; coordinates: [number, number] };
  destination: { type: string; coordinates: [number, number] };
  intermediateStops: { location: string; point: object }[];
  departureTime: Date;
  availableSeats: number;
  price: number;
  status: RideStatus;
  passengers: {
    user: IUser;
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
  user: IUser;
  ride: IRide;
  searchEventId?: ISearchEvent;
}

export interface ISearchEvent extends IEventBase {
  kind: 'search';
  user: IUser;
  durationMs: number;
  resultsCount: number;
}

export interface INotificationEvent extends IEventBase {
  kind: 'notification';
  scope: NotificationScope;
  subscription?: INotificationSubscription;
  user?: IUser;
  category: NotificationEventCategory;
  type: NotificationType;
  payload: string;
  statusHistory: Array<{ status: NotificationStatusHistory; timestamp: Date; details?: string }>;
  isAggregated: boolean;
  isCritical: boolean;
}

export interface IVehicle extends Document {
  owner: Types.ObjectId | IUser;
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
  user: IUser;
  status: PassengerStatus;
  requestedAt: Date;
  managedAt?: Date;
}

export interface IChatMessage extends Document {
  ride: IRide;
  sender: IUser;
  content: string;
  status: MessageStatus;
  isModerated: boolean;
  deliveredAt?: Date;
  readAt?: Date;
  moderationDetails?: {
    originalContent: string;
    moderatedBy: IUser;
    moderatedAt: Date;
    reason: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface INotificationPayload {
  category: NotificationEventCategory;
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
  user: IUser;
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
    rides?: boolean;
    chats?: boolean;
    communication?: boolean;
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
  user: Types.ObjectId | IUser;
  reason: 'rate_limit' | 'aggregation';
  createdAt: Date;
  updatedAt: Date;
}

export interface IPasswordReset extends Document {
  user: IUser;
  status: PasswordResetStatus;
  initiatedAt: Date;
  completedAt?: Date;
  expiresAt: Date;
}

export interface IPrivacyRequest extends Document {
  user: IUser;
  type: PrivacyRequestType;
  status: PrivacyRequestStatus;
  requestedAt: Date;
  completedAt?: Date;
  adminUser?: IUser;
}

export interface ILoginAttempt extends Document {
  user?: IUser;
  email: string;
  ipAddress: string;
  device: string;
  wasSuccessful: boolean;
  timestamp: Date;
}

export interface Location extends Document {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
  address?: string;
}

export interface ILocationLog extends Document {
  ride: IRide;
  user: IUser;
  action: LocationLogAction;
  timestamp: Date;
}

export interface IEventBase extends Document {
  _id: Types.ObjectId;
  kind: EventKind;
  user?: IUser | null;
}