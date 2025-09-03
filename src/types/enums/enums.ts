
export enum PassengerStatus {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
  Cancelled = 'cancelled',
}

export enum RideStatus {
  Scheduled = 'scheduled',
  InProgress = 'in_progress',
  Completed = 'completed',
  Cancelled = 'cancelled',
}

export enum MessageStatus {
  Sent = 'sent',
  Received = 'received',
  Read = 'read',
}

export enum UserRole {
  Caroneiro = 'caroneiro',
  Motorista = 'motorista',
  Admin = 'admin',
}

export enum UserStatus {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
  Suspended = 'suspended',
  Banned = 'banned',
  Anonymized = 'anonymized',
}

export enum LocationLogAction {
  SharingStarted = 'sharing_started',
  SharingStopped = 'sharing_stopped',
}

export enum NotificationType {
  RIDE_REQUEST = 'ride_request',
  RIDE_APPROVED = 'ride_approved',
  RIDE_CANCELLED = 'ride_cancelled',
  MESSAGE_RECEIVED = 'message_received',
  SECURITY_ALERT = 'security_alert',
  SYSTEM_NOTIFICATION = 'system_notification'
}

export enum VehicleStatus {
  Active = 'active',
  Inactive = 'inactive',
  Pending = 'pending',
  Rejected = 'rejected',
}