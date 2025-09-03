import { Schema, model } from 'mongoose';
import { ISearchEvent } from 'types';

const SearchEventSchema = new Schema<ISearchEvent>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  durationMs: { type: Number, required: true },
  resultsCount: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
});

export const SearchEventModel = model<ISearchEvent>('SearchEvent', SearchEventSchema);
