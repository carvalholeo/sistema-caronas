import { Schema, model } from 'mongoose';
import { IBlock } from 'types';
import { BlockStatus } from 'types/enums/enums';

const BlockSchema = new Schema<IBlock>({
  blockerUser: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  blockedUser: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  reason: { type: String, required: true },
  status: { type: String, enum: Object.values(BlockStatus), default: BlockStatus.APPLIED },
}, { timestamps: true, validateBeforeSave: true });

BlockSchema.index({ blockerUser: 1, blockedUser: 1 });
BlockSchema.index(
  { blockerUser: 1, blockedUser: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: BlockStatus.APPLIED } }
);

const allowedTransitions: Record<BlockStatus, BlockStatus[]> = {
  [BlockStatus.APPLIED]: [BlockStatus.REVERSED, BlockStatus.REVERSED_BY_ADMIN],
  [BlockStatus.REVERSED]: [],
  [BlockStatus.REVERSED_BY_ADMIN]: [],
};

BlockSchema.pre<IBlock>('validate', async function (next) {
  // status inicial deve ser 'applied'
  if (this.isNew) {
    if (this.status !== BlockStatus.APPLIED) {
      return next(new Error(`Invalid initial status: ${this.status}. Must start as "applied"`));
    }
    if (this.blockerUser && this.blockedUser &&
      this.blockerUser.toString() === this.blockedUser.toString()) {
      // marca o campo como inválido para obter mensagem amigável de validação
      this.invalidate('blockedUser', 'blockedUser must be different from blockerUser on insert');
      return next(new Error('blockedUser must be different from blockerUser on insert'));
    }
    return next();
  }

  if (!this.isModified('status')) {
    return next();
  }

  // valor anterior (Mongoose 8 suporta previous em get)
  const persisted = await (this.constructor as typeof BlockModel).findById(this._id).select('status').lean();
  const prevStatus: BlockStatus | undefined = persisted?.status;

  if (prevStatus === null) {
    return next();
  }

  if (prevStatus === BlockStatus.REVERSED || prevStatus === BlockStatus.REVERSED_BY_ADMIN) {
    return next(new Error(`Block is terminal (${prevStatus}); status cannot change`));
  }

  const allowed = allowedTransitions[prevStatus!] || [];
  if (!allowed.includes(this.status as BlockStatus)) {
    return next(new Error(`Invalid transition: ${prevStatus} -> ${this.status}`));
  }

  return next();
});


export const BlockModel = model<IBlock>('Block', BlockSchema);
