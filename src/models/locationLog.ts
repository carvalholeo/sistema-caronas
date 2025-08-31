import { Schema, model, Document, Types } from 'mongoose';

export enum LocationLogAction {
  SharingStarted = 'sharing_started',
  SharingStopped = 'sharing_stopped',
}

interface ILocationLog extends Document {
  ride: Types.ObjectId;
  user: Types.ObjectId;
  action: LocationLogAction;
  timestamp: Date;
}

const LocationLogSchema = new Schema<ILocationLog>({
  ride: { type: Schema.Types.ObjectId, ref: 'Ride', required: true, index: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, enum: Object.values(LocationLogAction), required: true },
  timestamp: { type: Date, default: Date.now },
});

export const LocationLogModel = model<ILocationLog>('LocationLog', LocationLogSchema);
