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
  // Setar completedAt somente ao entrar em COMPLETED
  if (this.isModified('status') && this.status === PasswordResetStatus.COMPLETED) {
    if (!this.completedAt) {
      this.completedAt = new Date();
    }
    if (this.completedAt < this.initiatedAt) {
      return next(new Error('completedAt cannot be earlier than initiatedAt'));
    }
  }

  return next();
});

PasswordResetSchema.pre<IPasswordReset>('validate', function (next) {
  // initiatedAt deve existir e ser imutável após criação
  if (!this.initiatedAt) {
    this.initiatedAt = new Date();
  }

  // Se status modificou, validar transição
  if (this.isModified('status')) {
    const prevStatus: PasswordResetStatus | undefined = this.get('status', null, { getters: false, virtuals: false, defaults: false, alias: false, setters: false, previous: true });

    // Para doc novo, aceitar apenas INITIATED
    if (this.isNew) {
      if (this.status !== PasswordResetStatus.INITIATED) {
        return next(new Error(`Invalid initial status: ${this.status}. Must start as INITIATED`));
      }
      return next();
    }

    if (prevStatus && prevStatus !== this.status) {
      const allowed = allowedTransitions[prevStatus] || [];
      if (!allowed.includes(this.status)) {
        return next(new Error(`Invalid transition: ${prevStatus} -> ${this.status}`));
      }
    }
  }

  // Ninguém pode alterar qualquer coisa se terminal (exceto leitura). Se terminal e está tentando modificar status, bloquear.
  const terminalStatuses = new Set<PasswordResetStatus>([
    PasswordResetStatus.COMPLETED,
    PasswordResetStatus.CANCELLED,
    PasswordResetStatus.EXPIRED,
  ]);
  const prevStatus: PasswordResetStatus | undefined = this.get('status', null, { previous: true });
  if (prevStatus && terminalStatuses.has(prevStatus) && this.isModified('status')) {
    return next(new Error(`Document is terminal (${prevStatus}); status cannot change`));
  }

  // completedAt regras de consistência
  if (this.status !== PasswordResetStatus.COMPLETED && this.completedAt) {
    return next(new Error(`completedAt present but status is ${this.status}; only allowed when COMPLETED`));
  }
  if (this.status === PasswordResetStatus.COMPLETED) {
    // completedAt será garantido no pre('save'), mas aqui validamos coerência temporal se já existir
    if (this.completedAt && this.completedAt < this.initiatedAt) {
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
