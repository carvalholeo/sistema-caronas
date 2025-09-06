import mongoose, { Schema, model, Types, Document } from 'mongoose';
import { IEventBase, INotificationEvent, IRideViewEvent, ISearchEvent } from 'types';
import { NotificationStatusHistory } from 'types/types/events';

const baseOptions = {
  discriminatorKey: 'kind', // campo que identifica o subtipo
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'events',
};

const EventSchema = new Schema<IEventBase>(
  {
    // kind será preenchido pelos discriminators
    user: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  baseOptions
);

const NotificationEventSchema = new Schema<INotificationEvent>(
  {
    subscription: { type: Schema.Types.ObjectId, ref: 'NotificationSubscription', required: true, index: true },
    category: { type: String, required: true, index: true },
    statusHistory: [
      {
        status: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        details: { type: String },
        _id: false,
      },
    ],
    isAggregated: { type: Boolean, default: false, index: true },
    isCritical: { type: Boolean, default: false, index: true },
  },
  { _id: false }
);

const RideViewEventSchema = new Schema<IRideViewEvent>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    ride: { type: Schema.Types.ObjectId, ref: 'Ride', required: true, index: true },
    searchEventId: { type: Schema.Types.ObjectId, ref: 'Event' }, // aponta para um Event do tipo 'search'
  },
  { _id: false }
);

const SearchEventSchema = new Schema<ISearchEvent>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    durationMs: { type: Number, required: true, min: 0 },
    resultsCount: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

export const EventModel = model<IEventBase>('Event', EventSchema);

export const NotificationEventModel = EventModel.discriminator<INotificationEvent>(
  'notification',
  NotificationEventSchema
);
export const RideViewEventModel = EventModel.discriminator<IRideViewEvent>(
  'ride_view',
  RideViewEventSchema
);

export const SearchEventModel = EventModel.discriminator<ISearchEvent>(
  'search',
  SearchEventSchema
);
