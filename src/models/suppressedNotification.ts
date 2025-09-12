import { Schema, model } from 'mongoose';
import { ISuppressedNotification } from 'types';
import { SuppressionReason } from 'types/enums/enums';

const SuppressedNotificationSchema = new Schema<ISuppressedNotification>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, required: true, enum: Object.values(SuppressionReason) },
}, { timestamps: true });

export const SuppressedNotificationModel = model<ISuppressedNotification>('SuppressedNotification', SuppressedNotificationSchema);
