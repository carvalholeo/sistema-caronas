import { Schema, model } from 'mongoose';
import { ILocationLog } from 'types';
import { LocationLogAction } from 'types/enums/enums';

const LocationLogSchema = new Schema<ILocationLog>({
  ride: { type: Schema.Types.ObjectId, ref: 'Ride', required: true, index: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, enum: Object.values(LocationLogAction), required: true },
  timestamp: { type: Date, default: Date.now },
});

export const LocationLogModel = model<ILocationLog>('LocationLog', LocationLogSchema);
