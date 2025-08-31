import { Schema, model, Document, Types } from 'mongoose';

interface IRideViewEvent extends Document {
  user: Types.ObjectId;
  ride: Types.ObjectId;
  searchEventId?: Types.ObjectId;
  timestamp: Date;
}

const RideViewEventSchema = new Schema<IRideViewEvent>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  ride: { type: Schema.Types.ObjectId, ref: 'Ride', required: true },
  searchEventId: { type: Schema.Types.ObjectId, ref: 'SearchEvent' },
  timestamp: { type: Date, default: Date.now },
});

export const RideViewEventModel = model<IRideViewEvent>('RideViewEvent', RideViewEventSchema);
