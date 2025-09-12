import { Schema, Types, model } from 'mongoose';
import { IChatMessage, IRide, RidePassenger } from 'types';
import { MessageStatus } from 'types/enums/enums';

const ChatMessageSchema = new Schema<IChatMessage>({
  ride: { type: Schema.Types.ObjectId, ref: 'Ride', required: true },
  sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000,
    validate: {
      validator: function (content: string) {
        const re = /^[\p{L}\p{N}\p{P}\p{Z}\s]*$/u;
        return re.test(content);
      },
      message: 'Message content contains invalid characters',
    },
  },
  status: { type: String, enum: Object.values(MessageStatus), default: MessageStatus.Sent, index: true },
  deliveredAt: { type: Date },
  readAt: { type: Date },
  isModerated: { type: Boolean, default: false },
  moderationDetails: {
    originalContent: { type: String },
    moderatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    moderatedAt: { type: Date },
    reason: { type: String },
  },
}, { timestamps: true, validateBeforeSave: true });

ChatMessageSchema.index({ ride: 1, createdAt: 1 });
ChatMessageSchema.index({ ride: 1, sender: 1, createdAt: 1 });

const allowedTransitions: Record<MessageStatus, MessageStatus[]> = {
  [MessageStatus.Sent]: [MessageStatus.Received, MessageStatus.Read],
  [MessageStatus.Received]: [MessageStatus.Read],
  [MessageStatus.Read]: [],
};

ChatMessageSchema.pre<IChatMessage>('validate', async function (next) {
  if (this.isNew) {
    const Ride = model<IRide>('Ride');
    const ride = await Ride.findById(this.ride).select({ driver: 1, passengers: 1 });

    if (!ride) {
      return next(new Error('Ride not found'));
    }

    const senderStr = this.sender.toString();
    const isDriver = ride.driver?.toString?.() === senderStr;
    const isPassenger = Array.isArray(ride.passengers) && ride.passengers.some((p: Partial<RidePassenger>) => {
      const id = (p && (p._id || p)) as Types.ObjectId;
      return id.toString() === senderStr;
    });

    if (!isDriver && !isPassenger) {
      return next(new Error('Users must be part of the ride to chat'));
    }
  }

  if (this.isModerated) {
    const md = this.moderationDetails;
    if (!md?.moderatedBy || !md?.moderatedAt || !md?.originalContent) {
      return next(new Error('moderationDetails fields (moderatedBy, moderatedAt, originalContent) are required when isModerated is true'));
    }
  }

  if (this.readAt && this.deliveredAt && this.readAt < this.deliveredAt) {
    return next(new Error('readAt cannot be earlier than deliveredAt'));
  }

  if (this.isModified('status')) {
    const persisted = await (this.constructor as typeof ChatMessageModel).findById(this._id).select('status').lean();
    const prevStatus: MessageStatus | undefined = persisted?.status;

    if (prevStatus && prevStatus !== this.status) {
      const allowed = allowedTransitions[prevStatus] || [];
      if (!allowed.includes(this.status)) {
        return next(new Error(`Invalid status transition: ${prevStatus} -> ${this.status}`));
      }
    }
  }

  return next();
});

ChatMessageSchema.pre<IChatMessage>('save', function (next) {
  if (this.isModified('status')) {
    switch (this.status as MessageStatus) {
      case MessageStatus.Received:
        if (!this.deliveredAt) this.deliveredAt = new Date();
        break;
      case MessageStatus.Read:
        if (!this.deliveredAt) this.deliveredAt = new Date();
        if (!this.readAt) this.readAt = new Date();
        break;
      default:
        break;
    }
  }

  if (this.readAt && this.deliveredAt && this.readAt < this.deliveredAt) {
    return next(new Error('readAt cannot be earlier than deliveredAt'));
  }

  return next();
});

export const ChatMessageModel = model<IChatMessage>('ChatMessage', ChatMessageSchema);
