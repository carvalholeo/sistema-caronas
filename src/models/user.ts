import { Schema, model } from 'mongoose';
import bcrypt from 'bcrypt';
import authConfig from 'config/auth';
import { IAccessibilitySettings, IUser } from 'types';
import { UserRole, UserStatus } from 'types/enums/enums';

// Subdocumento para configurações de acessibilidade
const AccessibilitySettingsSchema = new Schema<IAccessibilitySettings>({
  highContrast: { type: Boolean, default: false },
  largeFont: { type: Boolean, default: false },
  reduceAnimations: { type: Boolean, default: false },
  muteSounds: { type: Boolean, default: false },
});

const UserSchema = new Schema<IUser>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true, match: [
      /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      'Please enter a valid email address'
    ] },
  matricula: {
    type: String,
    required: true,
    unique: true,
    index: true,
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

  lastLogin: { type: Date },
  accessibilitySettings: { type: AccessibilitySettingsSchema, default: {} },
  languagePreference: { type: String, default: 'pt-BR' },
  profilePictureUrl: { type: String },
}, { timestamps: true });

UserSchema.methods.isTemporaryEmail = function(email: string): boolean {
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
  this.forcePasswordChangeOnNextLogin = false;
  this.sessionVersion = (this.sessionVersion || 0) + 1;
  next();
});

UserSchema.methods.comparePassword = async function(password: string): Promise<boolean> {
  return await bcrypt.compare(password, this.password);
};

UserSchema.pre<IUser>('validate', function (next) {
  if (!this.isModified('status')) {
    return next();
  }

  // valor anterior do status (Mongoose 8: use opção previous)
  const prevStatus: UserStatus | undefined = this.get('status', null, { previous: true });

  // documento novo: apenas Pending é permitido por padrão
  if (this.isNew) {
    if (this.status !== UserStatus.Pending) {
      return next(new Error(`Invalid initial status: ${this.status}. Must start as "pending"`));
    }
    return next();
  }

  if (prevStatus && prevStatus !== this.status) {
    const allowed = allowedTransitions[prevStatus] || [];
    if (!allowed.includes(this.status)) {
      return next(new Error(`Invalid transition: ${prevStatus} -> ${this.status}`));
    }
  }

  // Estados terminais: anonymized é terminal
  if (prevStatus === UserStatus.Anonymized && this.isModified('status')) {
    return next(new Error('User is anonymized (terminal); status cannot change'));
  }

  return next();
});

const allowedTransitions: Record<UserStatus, UserStatus[]> = {
  [UserStatus.Pending]: [UserStatus.Approved, UserStatus.Rejected, UserStatus.Suspended, UserStatus.Banned, UserStatus.Anonymized],
  [UserStatus.Approved]: [UserStatus.Suspended, UserStatus.Banned, UserStatus.Anonymized],
  [UserStatus.Suspended]: [UserStatus.Approved, UserStatus.Banned, UserStatus.Anonymized],
  [UserStatus.Banned]: [UserStatus.Suspended, UserStatus.Anonymized],
  [UserStatus.Rejected]: [UserStatus.Pending, UserStatus.Anonymized],
  [UserStatus.Anonymized]: [],
};


export const UserModel = model<IUser>('User', UserSchema);
