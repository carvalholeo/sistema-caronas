
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

export enum AuditActionType {
  // === Categoria: Autenticação (auth) ===
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILURE = 'login_failure',
  LOGOUT = 'logout',
  PASSWORD_RESET_REQUEST = 'password_reset_request',
  PASSWORD_RESET_SUCCESS = 'password_reset_success',
  TWO_FACTOR_SETUP_SUCCESS = '2fa_setup_success',
  TWO_FACTOR_VERIFICATION_SUCCESS = '2fa_verification_success',
  TWO_FACTOR_REMOVED_BY_ADMIN = '2fa_removed_by_admin',

  // === Categoria: Gestão de Usuários (user & admin) ===
  USER_REGISTERED = 'user_registered',
  USER_APPROVED_BY_ADMIN = 'user_approved_by_admin',
  USER_REJECTED_BY_ADMIN = 'user_rejected_by_admin',
  USER_SUSPENDED_BY_ADMIN = 'user_suspended_by_admin',
  USER_BANNED_BY_ADMIN = 'user_banned_by_admin',
  USER_RESTORED_BY_ADMIN = 'user_restored_by_admin',
  USER_PROFILE_UPDATED_BY_ADMIN = 'user_profile_updated_by_admin',
  USER_PASSWORD_CHANGE_FORCED_BY_ADMIN = 'user_password_change_forced_by_admin',

  // === Categoria: Gestão de Administradores (admin) ===
  USER_PROMOTED_TO_ADMIN = 'user_promoted_to_admin',
  USER_DEMOTED_FROM_ADMIN = 'user_demoted_from_admin',
  ADMIN_PERMISSIONS_UPDATED = 'admin_permissions_updated',

  // === Categoria: Gestão de Caronas (ride & admin) ===
  RIDE_CREATED = 'ride_created',
  RIDE_UPDATED = 'ride_updated',
  RIDE_UPDATED_BY_ADMIN = 'ride_updated_by_admin',
  RIDE_CANCELLED_BY_DRIVER = 'ride_cancelled_by_driver',
  RIDE_CANCELLED_BY_ADMIN = 'ride_cancelled_by_admin',
  RIDE_DETAILS_VIEWED_BY_ADMIN = 'ride_details_viewed_by_admin',
  RIDE_FORCE_PUBLISHED_BY_ADMIN = 'ride_force_published_by_admin',
  RIDE_STARTED = 'ride_started',
  RIDE_COMPLETED = 'ride_completed',

  // === Categoria: Gestão de Veículos (vehicle & admin) ===
  VEHICLE_CREATED = 'vehicle_created',
  VEHICLE_UPDATED = 'vehicle_updated',
  VEHICLE_DELETED = 'vehicle_deleted',
  VEHICLE_APPROVED_BY_ADMIN = 'vehicle_approved_by_admin', // Para casos de placa duplicada
  VEHICLE_REJECTED_BY_ADMIN = 'vehicle_rejected_by_admin',

  // === Categoria: Chat (chat & admin) ===
  CHAT_HISTORY_VIEWED_BY_ADMIN = 'chat_history_viewed_by_admin',
  CHAT_MESSAGE_MODERATED_BY_ADMIN = 'chat_message_moderated_by_admin',
  CHAT_LOGS_EXPORTED_BY_ADMIN = 'chat_logs_exported_by_admin',

  // === Categoria: Privacidade (privacy & admin) ===
  PRIVACY_DATA_REPORT_GENERATED = 'privacy_data_report_generated',
  PRIVACY_USER_REMOVAL_PROCESSED = 'privacy_user_removal_processed', // Soft delete
  PRIVACY_LOGS_VIEWED_BY_ADMIN = 'privacy_logs_viewed_by_admin',
  PRIVACY_FORMAL_NOTIFICATION_SENT = 'privacy_formal_notification_sent',

  // === Categoria: Segurança (admin) ===
  SECURITY_BLOCK_REASONS_VIEWED_BY_ADMIN = 'security_block_reasons_viewed_by_admin',
  SECURITY_USER_SESSIONS_REVOKED_BY_ADMIN = 'security_user_sessions_revoked_by_admin',
  SECURITY_ACCESS_DENIED = 'security_access_denied', // Tentativa de ação sem permissão

  // === Categoria: Localização (ride) ===
  LOCATION_SHARING_STARTED = 'location_sharing_started',
  LOCATION_SHARING_STOPPED = 'location_sharing_stopped',

   // === Categoria: Requisição (request) ===
  REQUEST_LOG = 'request_log',
}

export enum AuditLogCategory {
  AUTH = 'auth',
  USER = 'user',
  RIDE = 'ride',
  CHAT = 'chat',
  VEHICLE = 'vehicle',
  ADMIN = 'admin',
  PRIVACY = 'privacy',
  SECURITY = 'security',
  SYSTEM = 'system'
}

export enum AuditLogSeverityLevels {
  INFO = 'info',
  WARN = 'warning',
  CRITICAL= 'critical'
}

const StatusToActionLog: Record<UserStatus, AuditActionType> = {
  [UserStatus.Pending]: AuditActionType.USER_REGISTERED,
  [UserStatus.Approved]: AuditActionType.USER_APPROVED_BY_ADMIN,
  [UserStatus.Rejected]: AuditActionType.USER_REJECTED_BY_ADMIN,
  [UserStatus.Suspended]: AuditActionType.USER_SUSPENDED_BY_ADMIN,
  [UserStatus.Banned]: AuditActionType.USER_BANNED_BY_ADMIN,
  // Anonymized não tem um evento explícito no enum AuditActionType fornecido;
  // defina a política. Aqui, usamos USER_PROFILE_UPDATED_BY_ADMIN como aproximação.
  [UserStatus.Anonymized]: AuditActionType.USER_PROFILE_UPDATED_BY_ADMIN,
}

export function toAuditActionType(status: UserStatus): AuditActionType {
  return StatusToActionLog[status];
}