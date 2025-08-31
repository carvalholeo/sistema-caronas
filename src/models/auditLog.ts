import { Schema, model, Document, Types } from 'mongoose';

export interface IAuditLog extends Document {
  adminUser: Types.ObjectId;
  action: string;
  target: {
    type: 'user' | 'ride' | 'chat' | 'vehicle' | string;
    id: string;
  };
  details: {
    ipAddress: string;
    userAgent?: string;
    [key: string]: unknown | undefined;
  };
  timestamp: Date;
}

const AuditLogSchema = new Schema<IAuditLog>({
  adminUser: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  action: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  target: {
    type: { type: String, required: true },
    id: { type: String, required: true },
  },
  details: {
    ipAddress: {
      type: String,
      required: true,
      validate: {
        validator: function(ip: string) {
          // Basic IP validation (IPv4 and IPv6)
          const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
          const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
          return ipv4Regex.test(ip) || ipv6Regex.test(ip) || ip === '::1' || ip === '127.0.0.1';
        },
        message: 'Invalid IP address format'
      },
      index: true
    },
    userAgent: { type: String, maxLength: 500 },
    extra: {
      type: Schema.Types.Mixed,
      validate: {
        validator: function(extras: any) {
          // Ensure details don't contain sensitive information
          if (typeof extras === 'object' && extras !== null) {
            const sensitiveFields = ['password', 'token', 'secret', 'key'];
            const detailsString = JSON.stringify(extras).toLowerCase();
            return !sensitiveFields.some(field => detailsString.includes(field));
          }
          return true;
        },
        message: 'Audit log details cannot contain sensitive information'
      },
      default: {}
    },
   },
  timestamp: { type: Date, default: Date.now, immutable: true },
});

AuditLogSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate'], function() {
  throw new Error('Audit logs are immutable and cannot be updated');
});

AuditLogSchema.pre(['deleteOne', 'deleteMany', 'findOneAndDelete'], function() {
  throw new Error('Audit logs cannot be deleted');
});

export const AuditLogModel = model<IAuditLog>('AuditLog', AuditLogSchema);
