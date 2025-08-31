import { Schema, model, Document, Types } from 'mongoose';

interface INotificationSubscription extends Document {
  user: Types.ObjectId;
  deviceIdentifier: string;
  platform: 'web' | 'ios' | 'android';
  endpoint: string;
  keys: { p256dh: string; auth: string };
  isPermissionGranted: boolean;
  preferences: {
    security: boolean;
    rides: boolean;
    communication: boolean;
  };
}

const NotificationSubscriptionSchema = new Schema<INotificationSubscription>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  deviceIdentifier: { type: String, required: true },
  platform: { type: String, enum: ['web', 'ios', 'android'], required: true, default: 'web' },
  endpoint: { type: String, required: true },
  keys: { p256dh: { type: String }, auth: { type: String } },
  isPermissionGranted: { type: Boolean, default: true },
  preferences: {
    security: { type: Boolean, default: true },
    rides: { type: Boolean, default: true },
    communication: { type: Boolean, default: true },
  },
}, { timestamps: true });

NotificationSubscriptionSchema.index({ user: 1, deviceIdentifier: 1 }, { unique: true });

export const NotificationSubscriptionModel = model<INotificationSubscription>('NotificationSubscription', NotificationSubscriptionSchema);
