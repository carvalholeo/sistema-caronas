import { Schema, model } from 'mongoose';
import { IBlock } from 'types';
import { BlockStatus } from 'types/enums/enums';

const BlockSchema = new Schema<IBlock>({
    blockerUser: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    blockedUser: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    reason: { type: String, required: true },
    status: { type: String, enum: Object.values(BlockStatus), default: BlockStatus.APPLIED },
}, { timestamps: true });

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

BlockSchema.pre<IBlock>('validate', function (next) {
  const doc = this;

  // status inicial deve ser 'applied'
  if (doc.isNew) {
    if (doc.status !== BlockStatus.APPLIED) {
      return next(new Error(`Invalid initial status: ${doc.status}. Must start as "applied"`));
    }
    return next();
  }

  if (!doc.isModified('status')) {
    return next();
  }

  // valor anterior (Mongoose 8 suporta previous em get)
  const prevStatus: BlockStatus | undefined = doc.get('status', null, { previous: true });
  if (prevStatus && prevStatus !== doc.status) {
    const allowed = allowedTransitions[prevStatus] || [];
    if (!allowed.includes(doc.status)) {
      return next(new Error(`Invalid transition: ${prevStatus} -> ${doc.status}`));
    }
    // estados terminais não saem
    if (prevStatus === BlockStatus.REVERSED || prevStatus === BlockStatus.REVERSED_BY_ADMIN) {
      return next(new Error(`Block is terminal (${prevStatus}); status cannot change`));
    }
  }

  return next();
});

BlockSchema.pre<IBlock>('validate', function (next) {
  const doc = this;
  if (doc.isNew) {
    if (doc.blockerUser && doc.blockedUser &&
        doc.blockerUser.toString() === doc.blockedUser.toString()) {
      // marca o campo como inválido para obter mensagem amigável de validação
      doc.invalidate('blockedUser', 'blockedUser must be different from blockerUser on insert');
      return next(new Error('blockedUser must be different from blockerUser on insert'));
    }
  }
  next();
});


export const BlockModel = model<IBlock>('Block', BlockSchema);
