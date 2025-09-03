import { Schema, model } from 'mongoose';
import bcrypt from 'bcrypt';
import authConfig from 'config/auth';
import { IAccessibilitySettings, IAuditLogSchema, IUser} from 'types';
import { UserRole, UserStatus } from 'types/enums/enums';

// Subdocumento para auditoria interna do usuário
const AuditLogSchema = new Schema<IAuditLogSchema>({
  action: { type: String, required: true },
  adminUser: { type: Schema.Types.ObjectId, ref: 'User' },
  timestamp: { type: Date, default: Date.now },
  reason: { type: String },
  details: { type: Schema.Types.Mixed },
});

// Subdocumento para configurações de acessibilidade
const AccessibilitySettingsSchema = new Schema<IAccessibilitySettings>({
  highContrast: { type: Boolean, default: false },
  largeFont: { type: Boolean, default: false },
  reduceAnimations: { type: Boolean, default: false },
  muteSounds: { type: Boolean, default: false },
});

const UserSchema = new Schema<IUser>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, match: [
      /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      'Please enter a valid email address'
    ] },
  matricula: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    match: [
      /^[A-Z][A-Z0-9]*$/,
      'Work ID must start with a letter and contain only letters and numbers'
    ]
  },
  password: {
    type: String,
    required: true,
    minlength: 8,
    select: false
  },
  roles: [{ type: String, enum: Object.values(UserRole) }],
  permissions: [{ type: String }],
  status: { type: String, enum: Object.values(UserStatus), default: UserStatus.Pending },
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorSecret: { type: String, select: false, default: '' },
  forcePasswordChangeOnNextLogin: { type: Boolean, default: false },
  sessionVersion: { type: Number, default: 0 },
  auditHistory: [AuditLogSchema],
  lastLogin: { type: Date },
  accessibilitySettings: { type: AccessibilitySettingsSchema, default: {} },
  languagePreference: { type: String, default: 'pt-BR' },
}, { timestamps: true });

UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ matricula: 1 }, { unique: true });

UserSchema.statics.isTemporaryEmail = function(email: string): boolean {
  const temporaryDomains = [
    '10minutemail.com',
    'guerrillamail.com',
    'tempmail.org',
    'throwaway.email',
    'mailinator.com',
    'temp-mail.org'
  ];

  const domain = email.split('@')[1];
  return temporaryDomains.includes(domain);
};

UserSchema.pre<IUser>('save', async function(next) {
  if (!this.isModified('password')) return next();

  this.password = await bcrypt.hash(this.password, authConfig.saltRounds);
  next();
});

UserSchema.methods.comparePassword = async function(password: string): Promise<boolean> {
  return await bcrypt.compare(password, this.password);
};

UserSchema.pre<IUser>('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export const UserModel = model<IUser>('User', UserSchema);
