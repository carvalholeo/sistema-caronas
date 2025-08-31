import { Schema, model, Document, Types } from 'mongoose';

interface IDataReport extends Document {
  user: Types.ObjectId;
  adminUser: Types.ObjectId;
  hash: Types.UUID;
  includedDataPoints: string[];
  createdAt: Date;
}

const DataReportSchema = new Schema<IDataReport>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  adminUser: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  hash: { type: Schema.Types.UUID, required: true, unique: true },
  includedDataPoints: [{ type: String }],
}, { timestamps: { createdAt: true, updatedAt: false } });

export const DataReportModel = model<IDataReport>('DataReport', DataReportSchema);
