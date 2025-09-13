import { Schema, model, Model } from 'mongoose';
import { IPasswordReset } from 'types';
import { PasswordResetStatus } from 'types/enums/enums';

const PasswordResetSchema = new Schema<IPasswordReset>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: Object.values(PasswordResetStatus), default: PasswordResetStatus.INITIATED },
  initiatedAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
  expiresAt: { type: Date, required: true, expires: 0 }
}, { timestamps: false });

PasswordResetSchema.pre<IPasswordReset>('save', function (next) {
  // For newly COMPLETED requests, set completedAt
  if (this.isModified('status') && this.status === PasswordResetStatus.COMPLETED && !this.completedAt) {
    this.completedAt = new Date();
  }
  return next();
});

PasswordResetSchema.pre<IPasswordReset>('save', async function (next) {
  // Ensure consistent initiatedAt value
  if (!this.initiatedAt) {
    this.initiatedAt = new Date();
  }

  // Validate completedAt rules first
  if (this.completedAt) {
    if (this.status !== PasswordResetStatus.COMPLETED) {
      return next(new Error(`completedAt present but status is ${this.status.toUpperCase()}`));
    }
    if (this.completedAt < this.initiatedAt) {
      return next(new Error('completedAt cannot be earlier than initiatedAt'));
    }
  }

  // Status validations
  if (this.isNew && this.status !== PasswordResetStatus.INITIATED) {
    return next(new Error(`Invalid initial status: ${this.status}. Must start as INITIATED`));
  }

  // Only validate transitions for existing documents with status changes
  if (!this.isNew && this.isModified('status')) {
    // Always fetch previous status from DB for existing docs
    let fromStatus: PasswordResetStatus | undefined;
    try {
      const prev = await (this.constructor as Model<IPasswordReset>).findById(this._id);
      fromStatus = prev ? prev.status : undefined;
    } catch {
      return next(new Error('Previous status not found'));
    }
    if (!fromStatus) {
      return next(new Error('Previous status not found'));
    }

    // Always block any status change from a terminal state or not allowed
    const allowed = allowedTransitions[fromStatus] || [];
    if (!allowed.includes(this.status)) {
      return next(new Error(`Invalid transition: ${fromStatus} -> ${this.status}`));
    }
  }

  // For newly COMPLETED requests, set completedAt
  if (this.isModified('status') && this.status === PasswordResetStatus.COMPLETED && !this.completedAt) {
    this.completedAt = new Date();
  }
  return next();
});

const allowedTransitions: Record<PasswordResetStatus, PasswordResetStatus[]> = {
  [PasswordResetStatus.INITIATED]: [
    PasswordResetStatus.CANCELLED,
    PasswordResetStatus.EXPIRED,
    PasswordResetStatus.VERIFIED,
  ],
  [PasswordResetStatus.VERIFIED]: [
    PasswordResetStatus.COMPLETED,
    PasswordResetStatus.EXPIRED,
  ],
  [PasswordResetStatus.COMPLETED]: [],
  [PasswordResetStatus.CANCELLED]: [],
  [PasswordResetStatus.EXPIRED]: [],
};

export const PasswordResetModel = model<IPasswordReset>('PasswordReset', PasswordResetSchema);
