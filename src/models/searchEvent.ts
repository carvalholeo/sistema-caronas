import { Schema, model, Document, Types } from 'mongoose';

interface ISearchEvent extends Document {
  user: Types.ObjectId;
  durationMs: number;
  resultsCount: number;
  timestamp: Date;
}

const SearchEventSchema = new Schema<ISearchEvent>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  durationMs: { type: Number, required: true },
  resultsCount: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
});

export const SearchEventModel = model<ISearchEvent>('SearchEvent', SearchEventSchema);
