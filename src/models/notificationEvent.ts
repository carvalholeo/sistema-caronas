import { Schema, model} from 'mongoose';
import { INotificationEvent } from 'types';


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
