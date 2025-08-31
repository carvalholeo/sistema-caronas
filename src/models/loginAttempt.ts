import { Schema, model, Document, Types } from 'mongoose';

interface ILoginAttempt extends Document {
  user?: Types.ObjectId;
  email: string;
  ipAddress: string;
  device: string;
  wasSuccessful: boolean;
  timestamp: Date;
}

const LoginAttemptSchema = new Schema<ILoginAttempt>({
  user: { type: Schema.Types.ObjectId, ref: 'User' },
  email: { type: String, required: true },
  ipAddress: {
    type: String,
    required: false,
    index: true,
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
  device: { type: String, required: true },
  wasSuccessful: { type: Boolean, required: true },
  timestamp: { type: Date, default: Date.now },
});

export const LoginAttemptModel = model<ILoginAttempt>('LoginAttempt', LoginAttemptSchema);
