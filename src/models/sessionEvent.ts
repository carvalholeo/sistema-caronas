import { Schema, model, Document, Types } from 'mongoose';

interface ISessionEvent extends Document {
  user: Types.ObjectId;
  type: 'refresh_token_rotation' | 'global_logout_admin';
  device?: string;
  ipAddress?: string;
  adminUser?: Types.ObjectId;
  timestamp: Date;
}

const SessionEventSchema = new Schema<ISessionEvent>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, required: true },
  device: { type: String },
  ipAddress: {
    type: String,
    validate: {
      validator: function(ip: string) {
        // Basic IP validation (IPv4 and IPv6)
        const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
        return ipv4Regex.test(ip) || ipv6Regex.test(ip) || ip === '::1' || ip === '127.0.0.1';
      },
      message: 'Invalid IP address format'
    }
  },
  adminUser: { type: Schema.Types.ObjectId, ref: 'User' },
  timestamp: { type: Date, default: Date.now },
});

SessionEventSchema.index({ user: 1, type: 1 });
SessionEventSchema.index({ ipAddress: 1 });
SessionEventSchema.index({ user: 1, ipAddress: 1 });
SessionEventSchema.index({ type: 1 });

export const SessionEventModel = model<ISessionEvent>('SessionEvent', SessionEventSchema);
