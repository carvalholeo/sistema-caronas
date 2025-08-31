import { Schema, model, Document, Types } from 'mongoose';

interface IAccessDenialLog extends Document {
  adminUser: Types.ObjectId;
  requiredPermission: string;
  attemptedAction: string;
  target?: object;
}

const AccessDenialLogSchema = new Schema<IAccessDenialLog>({
  adminUser: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  requiredPermission: { type: String, required: true },
  attemptedAction: { type: String, required: true },
  target: { type: Schema.Types.Mixed },
}, { timestamps: { createdAt: true, updatedAt: false }});

AccessDenialLogSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate'], function() {
  throw new Error('Access denial logs are immutable and cannot be updated');
});

AccessDenialLogSchema.pre(['deleteOne', 'deleteMany', 'findOneAndDelete'], function() {
  throw new Error('Access denial logs cannot be deleted');
});

export const AccessDenialLogModel = model<IAccessDenialLog>('AccessDenialLog', AccessDenialLogSchema);
