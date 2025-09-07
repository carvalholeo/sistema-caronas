import { Schema, model } from 'mongoose';
import { INotificationPreferences, INotificationSubscription } from 'types';
import { NotificationWeekDays } from 'types/enums/enums';

const PreferencesSchema = new Schema<INotificationPreferences>(
  {
    startMinute: { type: Number, required: true, min: 0, max: 1439 },
    endMinute: { type: Number, required: true, min: 0, max: 1439 },
    weekMask: { type: Number, required: true, min: 0, max: 127 },
    timezone: { type: String, required: true, default: 'America/Sao_Paulo' }, // ex.: "America/Sao_Paulo"
  },
  { _id: false }
);

PreferencesSchema.pre<INotificationPreferences>('validate', function (next) {
  const p = this;
  if (typeof p.startMinute !== 'number' || typeof p.endMinute !== 'number') return next();
  if (p.startMinute < 0 || p.startMinute > 1439) return next(new Error('startMinute out of range'));
  if (p.endMinute < 0 || p.endMinute > 1439) return next(new Error('endMinute out of range'));
  if (typeof p.weekMask !== 'number' || p.weekMask < 0 || p.weekMask > 127) {
    return next(new Error('weekMask out of range'));
  }
  if (typeof p.timezone !== 'string' || !p.timezone.includes('/')) {
    return next(new Error('timezone must be a valid IANA name'));
  }
  return next();
});

PreferencesSchema.methods.convertHourToDatabase = function (timeObject: {
  startHour: number; endHour: number; weekDays: NotificationWeekDays[]; timezone: string;
}) {
  const startMinute = (timeObject.startHour % 24) * 60;
  const endMinute = (timeObject.endHour % 24) * 60;
  return {
    startMinute,
    endMinute,
    weekMask: this.daysToMask(timeObject.weekDays),
    timezone: timeObject.timezone,
  };
}

PreferencesSchema.methods.convertHourFromDatabase = function (p: {
  startMinute: number; endMinute: number; weekMask: number; timezone: string;
}) {
  return {
    startHour: Math.floor(p.startMinute / 60),
    endHour: Math.floor(p.endMinute / 60),
    weekDays: this.maskToDays(p.weekMask),
    timezone: p.timezone,
  };
}

PreferencesSchema.methods.daysToMask = (days: NotificationWeekDays[]): number => {
  return days.reduce((mask, d) => mask | (1 << d), 0);
}

PreferencesSchema.methods.maskToDays = (mask: number): NotificationWeekDays[] => {
    return (Array.from({ length: 7 }, (_, d) => d) as NotificationWeekDays[])
    .filter((d) => (mask & (1 << d)) !== 0);
  }

const NotificationSubscriptionSchema = new Schema<INotificationSubscription>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  deviceIdentifier: { type: String, required: true },
  platform: { type: String, enum: ['web', 'ios', 'android', 'email'], required: true, default: 'web' },
  endpoint: { type: String, required: true },
  keys: { p256dh: { type: String }, auth: { type: String } },
  destination: { type: String },
  isPermissionGranted: { type: Boolean, default: true },
  notificationsKinds: {
    security: { type: Boolean, default: true },
    rides: { type: Boolean, default: false },
    chats: { type: Boolean, default: false },
    communication: { type: Boolean, default: false },
    system: { type: Boolean, default: true }
  },
  preferences: { type: PreferencesSchema }
}, { timestamps: true });

NotificationSubscriptionSchema.pre<INotificationSubscription>('save', function(next) {
  this.notificationsKinds.security = true;
  this.notificationsKinds.system = true;

  next();
});

NotificationSubscriptionSchema.index({ user: 1, deviceIdentifier: 1 }, { unique: true });

export const NotificationSubscriptionModel = model<INotificationSubscription>('NotificationSubscription', NotificationSubscriptionSchema);