import { Schema, model, Document, Types } from 'mongoose';

interface ISuppressedNotification extends Document {
  user: Types.ObjectId;
  reason: 'rate_limit' | 'aggregation';
}

const SuppressedNotificationSchema = new Schema<ISuppressedNotification>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, required: true },
}, { timestamps: true });

export const SuppressedNotificationModel = model<ISuppressedNotification>('SuppressedNotification', SuppressedNotificationSchema);
