import { Schema, model } from 'mongoose';
import { ISuppressedNotification } from 'types';

const SuppressedNotificationSchema = new Schema<ISuppressedNotification>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, required: true },
}, { timestamps: true });

export const SuppressedNotificationModel = model<ISuppressedNotification>('SuppressedNotification', SuppressedNotificationSchema);
