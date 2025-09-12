import { Schema, model } from 'mongoose';
import { IPrivacyRequest } from 'types';
import { PrivacyRequestStatus, PrivacyRequestType } from 'types/enums/enums';

const PrivacyRequestSchema = new Schema<IPrivacyRequest>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, required: true, enum: Object.values(PrivacyRequestType) },
  status: { type: String, enum: Object.values(PrivacyRequestStatus), default: PrivacyRequestStatus.REQUESTED },
  requestedAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
  adminUser: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: false });

PrivacyRequestSchema.pre<IPrivacyRequest>('validate', async function (next) {
  // requestedAt imutável após criação
  if (!this.isNew && this.isModified('requestedAt')) {
    return next(new Error('requestedAt cannot be modified after creation'));
  }

  // validar transições de status
  if (this.isModified('status')) {
    if (this.isNew) {
      // status inicial deve ser REQUESTED
      if (this.status !== PrivacyRequestStatus.REQUESTED) {
        return next(new Error(`Invalid initial status: ${this.status}. Must start as "requested"`));
      }
      return next();
    }

    const persisted = await (this.constructor as typeof PrivacyRequestModel).findById(this._id).select('status').lean();
    const prevStatus: PrivacyRequestStatus | undefined = persisted?.status;

    if (prevStatus && prevStatus !== this.status) {
      const allowed = allowedTransitions[prevStatus] || [];
      if (!allowed.includes(this.status)) {
        return next(new Error(`Invalid status transition: ${prevStatus} -> ${this.status}`));
      }
    }
  }

  // coerência temporal: se completedAt já estiver presente, deve ser >= requestedAt
  if (this.completedAt && this.requestedAt && this.completedAt < this.requestedAt) {
    return next(new Error('completedAt cannot be earlier than requestedAt'));
  }

  return next();
});

PrivacyRequestSchema.pre<IPrivacyRequest>('save', function (next) {
  if (this.isModified('status')) {
    switch (this.status) {
      case PrivacyRequestStatus.COMPLETED:
      case PrivacyRequestStatus.DENIED:
      case PrivacyRequestStatus.CANCELLED:
      case PrivacyRequestStatus.EXPIRED:
        if (!this.completedAt) this.completedAt = new Date();
        if (this.requestedAt && this.completedAt < this.requestedAt) {
          return next(new Error('completedAt cannot be earlier than requestedAt'));
        }
        break;
      default:
        // ao transitar para REQUESTED ou INITIATED, completedAt deve ficar vazio
        if (this.status === PrivacyRequestStatus.REQUESTED || this.status === PrivacyRequestStatus.INITIATED) {
          this.completedAt = undefined;
        }
        break;
    }
  }

  // garantir requestedAt na criação
  if (this.isNew && !this.requestedAt) {
    this.requestedAt = new Date();
  }

  return next();
});

const allowedTransitions: Record<PrivacyRequestStatus, PrivacyRequestStatus[]> = {
  [PrivacyRequestStatus.REQUESTED]: [PrivacyRequestStatus.INITIATED, PrivacyRequestStatus.CANCELLED],
  [PrivacyRequestStatus.INITIATED]: [
    PrivacyRequestStatus.COMPLETED,
    PrivacyRequestStatus.DENIED,
    PrivacyRequestStatus.CANCELLED,
    PrivacyRequestStatus.EXPIRED,
  ],
  [PrivacyRequestStatus.COMPLETED]: [],
  [PrivacyRequestStatus.CANCELLED]: [],
  [PrivacyRequestStatus.EXPIRED]: [],
  [PrivacyRequestStatus.DENIED]: [],
};

export const PrivacyRequestModel = model<IPrivacyRequest>('PrivacyRequest', PrivacyRequestSchema);
