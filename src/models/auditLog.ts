import { Schema, model } from 'mongoose';
import { IAuditLog } from 'types';
import { AuditActionType, AuditLogCategory, AuditLogSeverityLevels } from 'types/enums/enums';
import { ipValidator } from 'utils/ipValidator';

const AuditLogSchema = new Schema<IAuditLog>({
  actor: {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isAdmin: { type: Schema.Types.Boolean, required: true },
    ip: {
      type: Schema.Types.String,
      required: false,
      validate: {
        validator: ipValidator,
        message: 'Invalid IP address format'
      }
    },
    userAgent: {
      type: Schema.Types.String
    }
  },
  action: {
    actionType: {
      type: Object.values(AuditActionType),
      required: true,
    },
    category: {
      type: Object.values(AuditLogCategory),
      required: true
    },
    detail: {
      type: Schema.Types.String
    }
  },
  target: {
    resourceType: { type: Schema.Types.String, required: true },
    resourceId: { type: Schema.Types.ObjectId, required: true },
    beforeState: { type: Schema.Types.Mixed },
    afterState: { type: Schema.Types.Mixed }
  },
  metadata: {
    severity: {
      type: Object.values(AuditLogSeverityLevels),
    },
    relatedResources: {
      type: {
        type: Schema.Types.String,
      },
      id: {
        type: Schema.Types.ObjectId
      }
    },
    extra: {
      type: Schema.Types.Mixed,
      validate: {
        validator: function(extras: object) {
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
   }
}, { timestamps: { createdAt: true, updatedAt: false}});

AuditLogSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate'], function() {
  throw new Error('Audit logs are immutable and cannot be updated');
});

AuditLogSchema.pre(['deleteOne', 'deleteMany', 'findOneAndDelete'], function() {
  throw new Error('Audit logs cannot be deleted');
});

export const AuditLogModel = model<IAuditLog>('AuditLog', AuditLogSchema);
