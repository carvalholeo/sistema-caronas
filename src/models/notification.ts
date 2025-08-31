import { Schema, model, Document, Types } from 'mongoose';

export enum NotificationType {
  RIDE_REQUEST = 'ride_request',
  RIDE_APPROVED = 'ride_approved',
  RIDE_CANCELLED = 'ride_cancelled',
  MESSAGE_RECEIVED = 'message_received',
  SECURITY_ALERT = 'security_alert',
  SYSTEM_NOTIFICATION = 'system_notification'
}

export interface INotification extends Document {
  user: Types.ObjectId;
  type: NotificationType,
  title: string;
  content: string;
  data?: string;
  isRead: boolean;
  createdAt: Date;
  expiresAt?: Date;
}

const notificationSchema = new Schema<INotification>({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: Object.values(NotificationType),
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  data: {
    type: Schema.Types.Mixed,
    validate: {
      validator: function(data: object) {
        // Ensure data doesn't contain sensitive information
        if (typeof data === 'object' && data !== null) {
          const sensitiveFields = ['password', 'token', 'secret', 'key'];
          const dataString = JSON.stringify(data).toLowerCase();
          return !sensitiveFields.some(field => dataString.includes(field));
        }
        return true;
      },
      message: 'Notification data cannot contain sensitive information'
    }
  },
  isRead: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    validate: {
      validator: function(date: Date) {
        return !date || date > this.createdAt;
      },
      message: 'Expiry date must be after creation date'
    }
  }
});

const Notification = model<INotification>('Notification', notificationSchema);

export default Notification;