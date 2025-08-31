import { Schema, model, Document, Types } from 'mongoose';
import { IUser } from './user';

export enum MessageStatus {
  Sent = 'sent',
  Received = 'received',
  Read = 'read',
}

export interface IChatMessage extends Document {
  ride: Types.ObjectId;
  sender: IUser;
  content: string;
  status: MessageStatus;
  isModerated: boolean;
  deliveredAt?: Date;
  readAt?: Date;
  moderationDetails?: {
    originalContent: string;
    moderatedBy: Types.ObjectId;
    moderatedAt: Date;
    reason: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const ChatMessageSchema = new Schema<IChatMessage>({
  ride: { type: Schema.Types.ObjectId, ref: 'Ride', required: true },
  sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000,
    validate: {
      validator: function(content: string) {
        // Only allow text, no media or special characters that could be exploited
        return /^[\p{L}\p{N}\p{P}\p{Z}\s]*$/u.test(content);
      },
      message: 'Message content contains invalid characters'
    }
  },
  status: { type: String, enum: Object.values(MessageStatus), default: MessageStatus.Sent },
  deliveredAt: { type: Date },
  readAt: { type: Date },
  isModerated: { type: Boolean, default: false },
  moderationDetails: {
    originalContent: { type: String },
    moderatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    moderatedAt: { type: Date },
    reason: { type: String },
  },
}, { timestamps: true });

ChatMessageSchema.index({ ride: 1, sender: 1, createdAt: 1 });

ChatMessageSchema.pre<IChatMessage>('save', async function(next) {
  if (this.isNew) {
    const Ride = model('Ride');
    const ride = await Ride.findById(this.ride);

    if (!ride) {
      return next(new Error('Ride not found'));
    }

    const isDriverOrPassenger = ride.driver.toString() === this.sender.toString() ||
                                ride.passengers.some((p: IUser) =>
                                  p._id.toString() === this.sender.toString()
                                );

    if (!isDriverOrPassenger) {
      return next(new Error('Users must be part of the ride to chat'));
    }
  }

  next();
});

export const ChatMessageModel = model<IChatMessage>('ChatMessage', ChatMessageSchema);
