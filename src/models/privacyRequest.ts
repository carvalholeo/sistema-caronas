import { Schema, model } from 'mongoose';
import { IPrivacyRequest } from 'types';

const PrivacyRequestSchema = new Schema<IPrivacyRequest>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, required: true },
  status: { type: String, default: 'pending' },
  requestedAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
  adminUser: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: false });

PrivacyRequestSchema.pre('save', function (next) {
  if (!this.isNew && this.isModified('status') && this.status === 'pending') {
    return next(new Error('Cannot revert status back to pending'));
  }

  if (this.isModified('status')
    && (this.status == 'completed' || this.status == 'denied')
    && !this.isNew) {
    this.completedAt = new Date();
  }

  if (this.isModified('status')
    && (this.status == 'completed' || this.status == 'denied')
    && !this.isNew) {
    this.completedAt = new Date();
  }

  if (this.requestedAt && !this.isNew && this.isModified('requestedAt')) {
    return next(new Error('requestedAt cannot be modified after creation'));
  }

  if (this.completedAt && this.isModified('completedAt')) {
    if (this.requestedAt && this.completedAt < this.requestedAt) {
      return next(new Error('completedAt cannot be earlier than requestedAt'));
    }
  }

  if (this.isNew) {
    this.requestedAt = new Date();
  }
  next();
});

export const PrivacyRequestModel = model<IPrivacyRequest>('PrivacyRequest', PrivacyRequestSchema);
