import { Schema, model } from 'mongoose';
import { IPasswordReset } from 'types';

const PasswordResetSchema = new Schema<IPasswordReset>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['initiated', 'completed'], default: 'initiated' },
  initiatedAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
});

PasswordResetSchema.pre<IPasswordReset>('save', function(next) {
  if (this.isNew) {
    this.initiatedAt = new Date();
  }

  if (this.status === 'completed' && !this.completedAt) {
    this.completedAt = new Date();
  }

  if (this.status === 'initiated') {
    this.completedAt = undefined;
  }

  if (!this.user) {
    return next(new Error('User reference is required'));
  }

  if (this.status === 'completed' && this.completedAt) {
    if (this.completedAt < this.initiatedAt) {
      return next(new Error('completedAt cannot be earlier than initiatedAt'));
    }
    return next(new Error('Password reset already completed'));
  }

  next();
});

export const PasswordResetModel = model<IPasswordReset>('PasswordReset', PasswordResetSchema);
