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

PrivacyRequestSchema.pre<IPrivacyRequest>('save', function (next) {
  const doc = this;

  if (doc.isModified('status')) {
    switch (doc.status) {
      case PrivacyRequestStatus.COMPLETED:
      case PrivacyRequestStatus.DENIED:
      case PrivacyRequestStatus.CANCELLED:
      case PrivacyRequestStatus.EXPIRED:
        if (!doc.completedAt) doc.completedAt = new Date();
        if (doc.requestedAt && doc.completedAt < doc.requestedAt) {
          return next(new Error('completedAt cannot be earlier than requestedAt'));
        }
        break;
      default:
        // ao transitar para REQUESTED ou INITIATED, completedAt deve ficar vazio
        if (doc.status === PrivacyRequestStatus.REQUESTED || doc.status === PrivacyRequestStatus.INITIATED) {
          doc.completedAt = undefined;
        }
        break;
    }
  }

  // garantir requestedAt na criação
  if (doc.isNew && !doc.requestedAt) {
    doc.requestedAt = new Date();
  }

  return next();
});

PrivacyRequestSchema.pre<IPrivacyRequest>('validate', function (next) {
  const doc = this;

  // requestedAt imutável após criação
  if (!doc.isNew && doc.isModified('requestedAt')) {
    return next(new Error('requestedAt cannot be modified after creation'));
  }

  // validar transições de status
  if (doc.isModified('status')) {
    const prevStatus: PrivacyRequestStatus | undefined = doc.get('status', null, { previous: true });

    if (doc.isNew) {
      // status inicial deve ser REQUESTED
      if (doc.status !== PrivacyRequestStatus.REQUESTED) {
        return next(new Error(`Invalid initial status: ${doc.status}. Must start as "requested"`));
      }
      return next();
    }

    if (prevStatus && prevStatus !== doc.status) {
      const allowed = allowedTransitions[prevStatus] || [];
      if (!allowed.includes(doc.status)) {
        return next(new Error(`Invalid status transition: ${prevStatus} -> ${doc.status}`));
      }
    }
  }

  // coerência temporal: se completedAt já estiver presente, deve ser >= requestedAt
  if (doc.completedAt && doc.requestedAt && doc.completedAt < doc.requestedAt) {
    return next(new Error('completedAt cannot be earlier than requestedAt'));
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
