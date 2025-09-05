import { Schema, model } from 'mongoose';
import { IBlock } from 'types';

const BlockSchema = new Schema<IBlock>({
    blockerUser: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    blockedUser: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, required: true },
    status: { type: String, enum: ['active', 'reversed_by_admin'], default: 'active' },
}, { timestamps: true });

BlockSchema.index({ blockerUser: 1, blockedUser: 1 });

export const BlockModel = model<IBlock>('Block', BlockSchema);
