import { Schema, model } from 'mongoose';
import { IAuditLogSchema, IBlock } from 'types';

const AuditLogSchema = new Schema<IAuditLogSchema>({
  action: { type: String, required: true },
  adminUser: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  timestamp: { type: Date, default: Date.now },
  reason: { type: String },
});

const BlockSchema = new Schema<IBlock>({
    blockerUser: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    blockedUser: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, required: true },
    status: { type: String, enum: ['active', 'reversed_by_admin'], default: 'active' },
    auditHistory: [AuditLogSchema],
}, { timestamps: true });

BlockSchema.index({ blockerUser: 1, blockedUser: 1 });

export const BlockModel = model<IBlock>('Block', BlockSchema);
