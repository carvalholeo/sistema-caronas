import { Schema, model, Document, Types } from 'mongoose';

interface IFormalNotification extends Document {
  user: Types.ObjectId;
  privacyRequest?: Types.ObjectId;
  subject: string;
  sentAt: Date;
  adminUser: Types.ObjectId;
}

const FormalNotificationSchema = new Schema<IFormalNotification>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true, index: true },
  privacyRequest: { type: Schema.Types.ObjectId, ref: 'PrivacyRequest', immutable: true },
  subject: { type: String, required: true, immutable: true },
  sentAt: { type: Date, default: Date.now, immutable: true },
  adminUser: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true, index: true },
}, { timestamps: { createdAt: true, updatedAt: false }});

export const FormalNotificationModel = model<IFormalNotification>('FormalNotification', FormalNotificationSchema);
