import { Schema, model } from 'mongoose';
import { IEventBase, INotificationEvent, IRideViewEvent, ISearchEvent } from 'types';
import { NotificationScope, NotificationType } from 'types/enums/enums';

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

export const NotificationEventSchema = new Schema<INotificationEvent>(
  {
    scope: { type: String, enum: Object.values(NotificationScope), default: NotificationScope.General, index: true },
    // alvo: ou subscription (push subscr.) ou user (notificação direta)
    subscription: { type: Schema.Types.ObjectId, ref: 'NotificationSubscription', index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', index: true }, // permite override do base quando necessário
    category: { type: String, required: true, index: true },
    type: { type: String, enum: Object.values(NotificationType) },
    payload: {
      type: String,
      validate: { validator: validationFields, message: 'Notification payload cannot contain sensitive information' }
    },
    statusHistory: [{
      status: { type: String, required: true },
      timestamp: { type: Date, default: Date.now },
      details: {
        type: String,
        validate: { validator: validationFields, message: 'Notification payload cannot contain sensitive information' }
      },
      _id: false
    }],
    isAggregated: { type: Boolean, default: false, index: true },
    isCritical: { type: Boolean, default: false, index: true }
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

NotificationEventSchema.pre('validate', function(next) {
  const doc = this as any;
  // Exija subscription OU user; se scope = privacy, exija user
  if (!doc.subscription && !doc.user) {
    return next(new Error('Either subscription or user must be set for a notification'));
  }
  if (doc.scope === 'privacy' && !doc.user) {
    return next(new Error('Privacy notifications must target a user'));
  }
  next();
});

export const NotificationEventModel = EventModel.discriminator(
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

function validationFields(data: object) {
  // Ensure data doesn't contain sensitive information
  if (typeof data === 'object' && data !== null) {
    const sensitiveFields = ['password', 'token', 'secret', 'key'];
    const dataString = JSON.stringify(data).toLowerCase();
    return !sensitiveFields.some(field => dataString.includes(field));
  }
  return true;
}
