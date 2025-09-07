import { Schema, model } from 'mongoose';
import { IPasswordReset } from 'types';
import { PasswordResetStatus } from 'types/enums/enums';

const PasswordResetSchema = new Schema<IPasswordReset>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: Object.values(PasswordResetStatus), default: PasswordResetStatus.INITIATED },
  initiatedAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
  expiresAt: { type: Date, required: true, expires: 0}
}, { timestamps: false });

PasswordResetSchema.pre<IPasswordReset>('save', function (next) {
  const doc = this;

  // Setar completedAt somente ao entrar em COMPLETED
  if (doc.isModified('status') && doc.status === PasswordResetStatus.COMPLETED) {
    if (!doc.completedAt) {
      doc.completedAt = new Date();
    }
    if (doc.completedAt < doc.initiatedAt) {
      return next(new Error('completedAt cannot be earlier than initiatedAt'));
    }
  }

  return next();
});

PasswordResetSchema.pre<IPasswordReset>('validate', function (next) {
  const doc = this;

  // initiatedAt deve existir e ser imutável após criação
  if (!doc.initiatedAt) {
    doc.initiatedAt = new Date();
  }

  // Se status modificou, validar transição
  if (doc.isModified('status')) {
    const prevStatus: PasswordResetStatus | undefined = doc.get('status', null, { getters: false, virtuals: false, defaults: false, alias: false, setters: false, previous: true });

    // Para doc novo, aceitar apenas INITIATED
    if (doc.isNew) {
      if (doc.status !== PasswordResetStatus.INITIATED) {
        return next(new Error(`Invalid initial status: ${doc.status}. Must start as INITIATED`));
      }
      return next();
    }

    if (prevStatus && prevStatus !== doc.status) {
      const allowed = allowedTransitions[prevStatus] || [];
      if (!allowed.includes(doc.status)) {
        return next(new Error(`Invalid transition: ${prevStatus} -> ${doc.status}`));
      }
    }
  }

  // Ninguém pode alterar qualquer coisa se terminal (exceto leitura). Se terminal e está tentando modificar status, bloquear.
  const terminalStatuses = new Set<PasswordResetStatus>([
    PasswordResetStatus.COMPLETED,
    PasswordResetStatus.CANCELLED,
    PasswordResetStatus.EXPIRED,
  ]);
  const prevStatus: PasswordResetStatus | undefined = doc.get('status', null, { previous: true } as any);
  if (prevStatus && terminalStatuses.has(prevStatus) && doc.isModified('status')) {
    return next(new Error(`Document is terminal (${prevStatus}); status cannot change`));
  }

  // completedAt regras de consistência
  if (doc.status !== PasswordResetStatus.COMPLETED && doc.completedAt) {
    return next(new Error(`completedAt present but status is ${doc.status}; only allowed when COMPLETED`));
  }
  if (doc.status === PasswordResetStatus.COMPLETED) {
    // completedAt será garantido no pre('save'), mas aqui validamos coerência temporal se já existir
    if (doc.completedAt && doc.completedAt < doc.initiatedAt) {
      return next(new Error('completedAt cannot be earlier than initiatedAt'));
    }
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
