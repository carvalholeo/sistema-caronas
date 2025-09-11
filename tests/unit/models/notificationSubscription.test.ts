
import mongoose from 'mongoose';
import { NotificationSubscriptionModel } from '../../../src/models/notificationSubscription';
import { UserModel } from '../../../src/models/user';
import { INotificationSubscription, IUser } from '../../../src/types';
import { NotificationWeekDays } from '../../../src/types/enums/enums';

describe('NotificationSubscription Model', () => {
  let user: IUser;

  beforeEach(async () => {
    await NotificationSubscriptionModel.deleteMany({});
    await UserModel.deleteMany({});
    user = await new UserModel({ name: 'Test User', email: 'user@test.com', matricula: 'USER123', password: 'p' }).save();
  });

  function createSubscriptionData(overrides = {}): Partial<INotificationSubscription> {
    return {
      user: user._id,
      deviceIdentifier: 'test-device-123',
      platform: 'web',
      endpoint: 'https://example.com/push',
      keys: { p256dh: 'key', auth: 'auth' },
      ...overrides,
    };
  }

  describe('Subscription Creation', () => {
    it('should create a new subscription with valid data', async () => {
      const subData = createSubscriptionData();
      const sub = await new NotificationSubscriptionModel(subData).save();
      expect(sub._id).toBeDefined();
      expect(sub.user).toEqual(user._id);
      expect(sub.notificationsKinds.security).toBe(true);
      expect(sub.notificationsKinds.system).toBe(true);
    });

    it('should force security and system notifications to true', async () => {
      const subData = createSubscriptionData({
        notificationsKinds: { security: false, system: false, rides: true },
      });
      const sub = await new NotificationSubscriptionModel(subData).save();
      expect(sub.notificationsKinds.security).toBe(true);
      expect(sub.notificationsKinds.system).toBe(true);
      expect(sub.notificationsKinds.rides).toBe(true);
    });

    it('should fail if user, deviceIdentifier or endpoint are missing', async () => {
      await expect(new NotificationSubscriptionModel(createSubscriptionData({ user: undefined })).save()).rejects.toThrow('user: Path `user` is required');
      await expect(new NotificationSubscriptionModel(createSubscriptionData({ deviceIdentifier: undefined })).save()).rejects.toThrow('deviceIdentifier: Path `deviceIdentifier` is required');
      await expect(new NotificationSubscriptionModel(createSubscriptionData({ endpoint: undefined })).save()).rejects.toThrow('endpoint: Path `endpoint` is required');
    });

    it('should enforce unique constraint on user and deviceIdentifier', async () => {
      await new NotificationSubscriptionModel(createSubscriptionData()).save();
      await expect(new NotificationSubscriptionModel(createSubscriptionData()).save()).rejects.toThrow('E11000 duplicate key error');
    });
  });

  describe('Preferences Sub-Schema', () => {
    it('should save valid preferences', async () => {
      const subData = createSubscriptionData({
        preferences: {
          startMinute: 480, // 8:00
          endMinute: 1080, // 18:00
          weekMask: 31, // Mon-Fri
          timezone: 'America/Sao_Paulo',
        },
      });
      const sub = await new NotificationSubscriptionModel(subData).save();
      expect(sub.preferences).toBeDefined();
      expect(sub.preferences?.startMinute).toBe(480);
    });

    it('should fail with out-of-range preferences', async () => {
      const invalidPrefs = {
        preferences: { startMinute: 9999, endMinute: 1080, weekMask: 31, timezone: 'UTC' },
      };
      await expect(new NotificationSubscriptionModel(createSubscriptionData(invalidPrefs)).save()).rejects.toThrow('startMinute out of range');
    });

    it('should correctly convert between mask and days', () => {
        const sub = new NotificationSubscriptionModel();
        const days: NotificationWeekDays[] = [NotificationWeekDays.MONDAY, NotificationWeekDays.FRIDAY];
        const mask = sub.schema.path('preferences').schema.methods.daysToMask(days);
        expect(mask).toBe(34); // 1 << 1 | 1 << 5 = 2 | 32
        const convertedDays = sub.schema.path('preferences').schema.methods.maskToDays(mask);
        expect(convertedDays).toEqual(expect.arrayContaining(days));
    });

    it('should correctly convert between hour and database format', () => {
        const sub = new NotificationSubscriptionModel();
        const timeObject = { startHour: 9, endHour: 17, weekDays: [NotificationWeekDays.TUESDAY], timezone: 'UTC' };
        const dbFormat = sub.schema.path('preferences').schema.methods.convertHourToDatabase(timeObject);
        expect(dbFormat.startMinute).toBe(540);
        expect(dbFormat.endMinute).toBe(1020);
        expect(dbFormat.weekMask).toBe(4); // 1 << 2

        const hourFormat = sub.schema.path('preferences').schema.methods.convertHourFromDatabase(dbFormat);
        expect(hourFormat.startHour).toBe(9);
        expect(hourFormat.endHour).toBe(17);
        expect(hourFormat.weekDays).toEqual([NotificationWeekDays.TUESDAY]);
    });
  });
});
