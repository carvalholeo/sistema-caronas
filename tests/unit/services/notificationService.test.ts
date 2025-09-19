import { NotificationService } from '../../../src/services/notificationService';
import { NotificationSubscriptionModel } from '../../../src/models/notificationSubscription';
import { NotificationEventModel } from '../../../src/models/event';
import { SuppressedNotificationModel } from '../../../src/models/suppressedNotification';
import { WebPushProvider } from '../../../src/providers/notifications/WebPushProvider';
import { INotificationPayload, IUser } from '../../../src/types';
import { Types } from 'mongoose';

jest.mock('../../../src/providers/notifications/WebPushProvider');
jest.mock('../../../src/providers/notifications/AndroidProvider');
jest.mock('../../../src/providers/notifications/IosProvider');
jest.mock('../../../src/providers/notifications/EmailProvider');
jest.mock('../../../src/models/suppressedNotification');
jest.mock('../../../src/models/event');
jest.mock('../../../src/utils/quietHours', () => ({ shouldNotifyNow: jest.fn() }));

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    service = new NotificationService();
    jest.clearAllMocks();
  });

  describe('subscribe', () => {
    it('should throw an error if user ID or device identifier is missing', async () => {
      await expect(service.subscribe({ user: undefined, deviceIdentifier: undefined, platform: 'web' })).rejects.toThrow('User ID e Device Identifier são obrigatórios.');
    });

    it('should create or update a subscription', async () => {
      const userId = new Types.ObjectId();
      jest.spyOn(NotificationSubscriptionModel, 'findOneAndUpdate').mockResolvedValue({
        user: userId,
        deviceIdentifier: 'test-device',
        platform: 'web',
      });

      const user = { _id: userId } as unknown as IUser;

      const result = await service.subscribe({
        user,
        deviceIdentifier: 'test-device',
        platform: 'web',
      });

      expect(result).toEqual({
        user: user._id,
        deviceIdentifier: 'test-device',
        platform: 'web',
      });
      expect(NotificationSubscriptionModel.findOneAndUpdate).toHaveBeenCalledWith(
        { user: user, deviceIdentifier: 'test-device' },
        { $set: { user: user, deviceIdentifier: 'test-device', platform: 'web' } },
        { new: true, upsert: true, runValidators: true }
      );
    });
  });

  describe('updatePreferences', () => {
    it('should throw an error if subscription is not found', async () => {
      jest.spyOn(NotificationSubscriptionModel, 'findOne').mockResolvedValue(null);

      await expect(
        service.updatePreferences({ _id: new Types.ObjectId() } as IUser, 'test-device', { kinds: {} })
      ).rejects.toThrow('Assinatura de notificação não encontrada para este dispositivo.');
    });

    it('should update notification kinds', async () => {
      const userId = new Types.ObjectId();
      jest.spyOn(NotificationSubscriptionModel, 'findOne').mockResolvedValue({
        user: userId,
        deviceIdentifier: 'test-device',
        preferences: {},
        notificationsKinds: { chats: true, rides: true },
        save: jest.fn().mockResolvedValue(true),
      });

      await service.updatePreferences({ _id: userId } as IUser, 'test-device', { kinds: {'chats': true} });

      expect(NotificationSubscriptionModel.findOne).toHaveBeenCalledWith({
        user: userId,
        deviceIdentifier: 'test-device',
      });
    });
  });

  describe('sendNotification', () => {
    it('should not send if no subscriptions are found for a user', async () => {
      jest.spyOn(NotificationSubscriptionModel, 'find').mockResolvedValue([]);
      const userId = new Types.ObjectId();
      const user = { _id: userId } as unknown as IUser;
      await service.sendNotification([user], { title: 'Test', body: 'Test body' } as INotificationPayload);

      expect(NotificationSubscriptionModel.find).toHaveBeenCalledWith({ user: userId });
    });

    it('should send notifications to all valid subscriptions', async () => {
      const userId = new Types.ObjectId();
      // Adjust find mock to include valid preferences and notificationsKinds
      jest.spyOn(NotificationSubscriptionModel, 'find').mockResolvedValue([
        {
          user: userId,
          deviceIdentifier: 'test-device',
          platform: 'web',
          isPermissionGranted: true,
          notificationsKinds: { security: true },
          preferences: { weekMask: 127, startMinute: 0, endMinute: 1440, timezone: 'UTC' },
        },
      ]);

      // Mock shouldNotifyNow to always return true
      jest.spyOn(require('../../../src/utils/quietHours'), 'shouldNotifyNow').mockReturnValue(true);

      // Ensure sendSpy tracks calls correctly
      const sendSpy = jest.spyOn(WebPushProvider.prototype, 'send').mockResolvedValue(void 0);

      await service.sendNotification([{_id: userId } as unknown as IUser], { title: 'Test', body: 'Test body', category: 'security' } as INotificationPayload);

      expect(sendSpy).toHaveBeenCalled();
    });
  });

  describe('sendAndLogNotification', () => {
    it('should log event as delivered on successful send', async () => {
      jest.spyOn(NotificationEventModel.prototype, 'save').mockResolvedValue(true);
      const userId = new Types.ObjectId();
      const result = await (service as any).sendAndLogNotification(
        { user: userId, deviceIdentifier: 'test-device', platform: 'web' },
        { title: 'Test', body: 'Test body' }
      );

      expect(result).toBe(true);
      expect(NotificationEventModel.prototype.save).toHaveBeenCalled();
    });

    it('should log event as failed on send error', async () => {
      jest.spyOn(NotificationEventModel.prototype, 'save').mockResolvedValue(true);
      jest.spyOn(WebPushProvider.prototype, 'send').mockRejectedValue(new Error('Send failed'));

      const userId = new Types.ObjectId();

      const result = await (service as any).sendAndLogNotification(
        { user: userId, deviceIdentifier: 'test-device', platform: 'web' },
        { title: 'Test', body: 'Test body' }
      );

      expect(result).toBe(false);
      expect(NotificationEventModel.prototype.save).toHaveBeenCalled();
    });
  });
});
