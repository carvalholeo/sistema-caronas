import { Schema, model } from 'mongoose';
import { IAuditLogSchema } from '../types';

// Subdocumento de auditoria
const InternalAuditLogSchema = new Schema<IAuditLogSchema>({
  action: { type: String, required: true },
  adminUser: { type: Schema.Types.ObjectId, ref: 'User' },
  timestamp: { type: Date, default: Date.now, immutable: true },
  details: { type: Schema.Types.Mixed },
});

export const InternalAuditLogModel = model<IAuditLogSchema>('Ride', InternalAuditLogSchema);