import { Schema, model, Document, Types } from 'mongoose';

interface INotificationEvent extends Document {
  subscription: Types.ObjectId;
  category: 'security' | 'rides' | 'communication' | 'critical';
  statusHistory: { status: 'sent' | 'delivered' | 'clicked' | 'failed'; timestamp: Date; details?: string }[];
  isAggregated: boolean;
  isCritical: boolean;
}

const NotificationEventSchema = new Schema<INotificationEvent>({
  subscription: { type: Schema.Types.ObjectId, ref: 'NotificationSubscription', required: true },
  category: { type: String, required: true },
  statusHistory: [{
    status: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    details: { type: String },
  }],
  isAggregated: { type: Boolean, default: false },
  isCritical: { type: Boolean, default: false },
}, { timestamps: { createdAt: true, updatedAt: false } });

export const NotificationEventModel = model<INotificationEvent>('NotificationEvent', NotificationEventSchema);
