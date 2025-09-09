
import NotificationService from '../../../src/services/notificationService';
import { NotificationSubscriptionModel } from '../../../src/models/notificationSubscription';
import { NotificationEventModel } from '../../../src/models/event';
import { SuppressedNotificationModel } from '../../../src/models/suppressedNotification';
import { WebPushProvider } from '../../../src/providers/notifications/WebPushProvider';
import { AndroidProvider } from '../../../src/providers/notifications/AndroidProvider';
import { IosProvider } from '../../../src/providers/notifications/IosProvider';
import { EmailProvider } from '../../../src/providers/notifications/EmailProvider';
import { shouldNotifyNow } from '../../../src/utils/quietHours';
import logger from '../../../src/utils/logger';
import mongoose from 'mongoose';

// Mock all dependencies
jest.mock('../../../src/models/notificationSubscription');
jest.mock('../../../src/models/event');
jest.mock('../../../src/models/suppressedNotification');
jest.mock('../../../src/providers/notifications/WebPushProvider');
jest.mock('../../../src/providers/notifications/AndroidProvider');
jest.mock('../../../src/providers/notifications/IosProvider');
jest.mock('../../../src/providers/notifications/EmailProvider');
jest.mock('../../../src/utils/quietHours');
jest.mock('../../../src/utils/logger');

const mockedNotificationSubscriptionModel = NotificationSubscriptionModel as jest.Mocked<typeof NotificationSubscriptionModel>;
const mockedNotificationEventModel = NotificationEventModel as jest.Mocked<typeof NotificationEventModel>;
const mockedSuppressedNotificationModel = SuppressedNotificationModel as jest.Mocked<typeof SuppressedNotificationModel>;
const mockedWebPushProvider = WebPushProvider as jest.MockedClass<typeof WebPushProvider>;
const mockedAndroidProvider = AndroidProvider as jest.MockedClass<typeof AndroidProvider>;
const mockedIosProvider = IosProvider as jest.MockedClass<typeof IosProvider>;
const mockedEmailProvider = EmailProvider as jest.MockedClass<typeof EmailProvider>;
const mockedShouldNotifyNow = shouldNotifyNow as jest.Mock;
const mockedLogger = logger as jest.Mocked<typeof logger>;

describe('NotificationService', () => {
  let service: NotificationService;
  let mockWebPushSend: jest.Mock;
  let mockAndroidSend: jest.Mock;
  let mockIosSend: jest.Mock;
  let mockEmailSend: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules(); // Ensure a fresh instance of NotificationService

    mockWebPushSend = jest.fn().mockResolvedValue(undefined);
    mockedWebPushProvider.mockImplementation(() => ({
      send: mockWebPushSend,
    } as any));

    mockAndroidSend = jest.fn().mockResolvedValue(undefined);
    mockedAndroidProvider.mockImplementation(() => ({
      send: mockAndroidSend,
    } as any));

    mockIosSend = jest.fn().mockResolvedValue(undefined);
    mockedIosProvider.mockImplementation(() => ({
      send: mockIosSend,
    } as any));

    mockEmailSend = jest.fn().mockResolvedValue(undefined);
    mockedEmailProvider.mockImplementation(() => ({
      send: mockEmailSend,
    } as any));

    // Mock model constructors and their save methods
    (mockedNotificationEventModel as jest.Mock).mockImplementation(() => ({
      save: jest.fn().mockResolvedValue(true),
    }));
    (mockedSuppressedNotificationModel as jest.Mock).mockImplementation(() => ({
      save: jest.fn().mockResolvedValue(true),
    }));

    // Re-import the service after mocks are set up
    service = require('../../../src/services/notificationService').default;
  });

  describe('constructor', () => {
    it('should initialize all notification providers', () => {
      expect(mockedWebPushProvider).toHaveBeenCalledTimes(1);
      expect(mockedAndroidProvider).toHaveBeenCalledTimes(1);
      expect(mockedIosProvider).toHaveBeenCalledTimes(1);
      expect(mockedEmailProvider).toHaveBeenCalledTimes(1);
    });
  });

  describe('subscribe', () => {
    const userId = new mongoose.Types.ObjectId();
    const deviceIdentifier = 'test-device';

    it('should throw error if user ID or device identifier is missing', async () => {
      await expect(service.subscribe({ deviceIdentifier })).rejects.toThrow('User ID e Device Identifier são obrigatórios.');
      await expect(service.subscribe({ user: { _id: userId } as any })).rejects.toThrow('User ID e Device Identifier são obrigatórios.');
    });

    it('should create or update a subscription', async () => {
      const mockSubscription = { _id: 'sub-id', user: userId, deviceIdentifier, platform: 'web' };
      mockedNotificationSubscriptionModel.findOneAndUpdate.mockResolvedValue(mockSubscription as any);

      const result = await service.subscribe({ user: { _id: userId } as any, deviceIdentifier, platform: 'web' });

      expect(mockedNotificationSubscriptionModel.findOneAndUpdate).toHaveBeenCalledWith(
        { user: userId, deviceIdentifier },
        { $set: { user: { _id: userId }, deviceIdentifier, platform: 'web' } },
        { new: true, upsert: true, runValidators: true }
      );
      expect(result).toEqual(mockSubscription);
    });
  });

  describe('updatePreferences', () => {
    const userId = new mongoose.Types.ObjectId();
    const deviceIdentifier = 'test-device';
    let mockSubscription: any;

    beforeEach(() => {
      mockSubscription = {
        _id: 'sub-id',
        user: userId,
        deviceIdentifier,
        notificationsKinds: { security: true, rides: false, chats: false, communication: false, system: true },
        preferences: {
          startMinute: 0,
          endMinute: 1439,
          weekMask: 127,
          timezone: 'UTC',
          daysToMask: jest.fn(),
          convertHourToDatabase: jest.fn(),
        },
        save: jest.fn().mockResolvedValue(true),
      };
      mockedNotificationSubscriptionModel.findOne.mockResolvedValue(mockSubscription);
    });

    it('should throw error if subscription is not found', async () => {
      mockedNotificationSubscriptionModel.findOne.mockResolvedValue(null);
      await expect(service.updatePreferences({ _id: userId } as any, deviceIdentifier, {})).rejects.toThrow('Assinatura de notificação não encontrada');
    });

    it('should update notification kinds', async () => {
      const preferencesData = { kinds: { rides: true, chats: true } };
      await service.updatePreferences({ _id: userId } as any, deviceIdentifier, preferencesData);

      expect(mockSubscription.notificationsKinds.rides).toBe(true);
      expect(mockSubscription.notificationsKinds.chats).toBe(true);
      expect(mockSubscription.save).toHaveBeenCalledTimes(1);
    });

    it('should set preferences to undefined if quietHours is null', async () => {
      const preferencesData = { quietHours: null };
      await service.updatePreferences({ _id: userId } as any, deviceIdentifier, preferencesData);

      expect(mockSubscription.preferences).toBeUndefined();
      expect(mockSubscription.save).toHaveBeenCalledTimes(1);
    });

    it('should update quiet hours preferences', async () => {
      const preferencesData = {
        quietHours: {
          startHour: 9,
          endHour: 17,
          weekDays: [1, 2, 3],
          timezone: 'America/Sao_Paulo',
        },
      };
      mockSubscription.preferences.daysToMask.mockReturnValue(14);

      await service.updatePreferences({ _id: userId } as any, deviceIdentifier, preferencesData);

      expect(mockSubscription.preferences.daysToMask).toHaveBeenCalledWith([1, 2, 3]);
      expect(mockSubscription.preferences.convertHourToDatabase).toHaveBeenCalledWith({
        startMinute: 9,
        endMinute: 17,
        weekMask: 14,
        timezone: 'America/Sao_Paulo',
      });
      expect(mockSubscription.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('sendNotification', () => {
    const userId1 = new mongoose.Types.ObjectId();
    const userId2 = new mongoose.Types.ObjectId();
    const mockPayload = { title: 'Test', body: 'Body', category: 'general' };
    const mockCriticalPayload = { title: 'Critical', body: 'Critical Body', category: 'security' };

    let mockSub1: any, mockSub2: any, mockEmailSub: any;

    beforeEach(() => {
      mockSub1 = { _id: 'sub1', user: userId1, platform: 'web', isPermissionGranted: true, notificationsKinds: { general: true }, preferences: { weekMask: 1 } };
      mockSub2 = { _id: 'sub2', user: userId1, platform: 'android', isPermissionGranted: true, notificationsKinds: { general: true }, preferences: { weekMask: 1 } };
      mockEmailSub = { _id: 'sub3', user: userId1, platform: 'email', isPermissionGranted: true, notificationsKinds: { general: true } };

      mockedNotificationSubscriptionModel.find.mockResolvedValue([]);
      mockedShouldNotifyNow.mockReturnValue(true);

      // Spy on the private method sendAndLogNotification
      jest.spyOn(service as any, 'sendAndLogNotification').mockResolvedValue(true);
      jest.spyOn(service as any, 'shouldSend').mockReturnValue(true);
    });

    it('should not send if no subscriptions are found for a user', async () => {
      await service.sendNotification([{ _id: userId1 } as any], mockPayload);
      expect((service as any).sendAndLogNotification).not.toHaveBeenCalled();
    });

    it('should send non-critical notifications to all valid subscriptions', async () => {
      mockedNotificationSubscriptionModel.find.mockResolvedValue([mockSub1, mockSub2, mockEmailSub]);
      await service.sendNotification([{ _id: userId1 } as any], mockPayload);
      expect((service as any).sendAndLogNotification).toHaveBeenCalledTimes(2); // Web and Android
      expect((service as any).sendAndLogNotification).toHaveBeenCalledWith(mockSub1, mockPayload);
      expect((service as any).sendAndLogNotification).toHaveBeenCalledWith(mockSub2, mockPayload);
    });

    it('should suppress non-critical notifications if shouldSend returns false', async () => {
      mockedNotificationSubscriptionModel.find.mockResolvedValue([mockSub1]);
      (service as any).shouldSend.mockReturnValue(false);

      await service.sendNotification([{ _id: userId1 } as any], mockPayload);

      expect((service as any).sendAndLogNotification).not.toHaveBeenCalled();
      expect(mockedSuppressedNotificationModel).toHaveBeenCalledTimes(1);
      expect(mockedSuppressedNotificationModel).toHaveBeenCalledWith(expect.objectContaining({
        user: userId1,
        reason: 'Envio de notificação não permitida no canal/horário.'
      }));
    });

    it('should send critical notifications even if shouldSend is false for push, and fallback to email', async () => {
      mockedNotificationSubscriptionModel.find.mockResolvedValue([mockSub1, mockEmailSub]);
      (service as any).shouldSend.mockImplementation((sub: any, payload: any) => {
        if (sub.platform === 'web') return false; // Simulate push not sending
        return true; // Email should send
      });
      (service as any).sendAndLogNotification.mockResolvedValueOnce(false); // Simulate web push failure

      await service.sendNotification([{ _id: userId1 } as any], mockCriticalPayload);

      expect(mockedLogger.info).toHaveBeenCalledWith(expect.stringContaining('Fallback: Enviando notificação crítica por e-mail'));
      expect((service as any).sendAndLogNotification).toHaveBeenCalledTimes(2); // One for web, one for email fallback
      expect((service as any).sendAndLogNotification).toHaveBeenCalledWith(mockEmailSub, mockCriticalPayload);
    });
  });

  describe('sendAndLogNotification (private)', () => {
    const mockSubscription: any = { _id: new mongoose.Types.ObjectId(), platform: 'web', endpoint: 'test-endpoint' };
    const mockPayload = { title: 'Test', body: 'Body', category: 'general' };

    it('should return false if provider is not found', async () => {
      // Temporarily remove web provider
      (service as any).providers.delete('web');
      const result = await (service as any).sendAndLogNotification(mockSubscription, mockPayload);
      expect(result).toBe(false);
    });

    it('should log event as delivered on successful send', async () => {
      mockWebPushSend.mockResolvedValue(undefined);
      const result = await (service as any).sendAndLogNotification(mockSubscription, mockPayload);

      expect(mockedNotificationEventModel).toHaveBeenCalledTimes(2); // Sent and Delivered
      const sentLog = (mockedNotificationEventModel as jest.Mock).mock.calls[0][0];
      const deliveredLog = (mockedNotificationEventModel as jest.Mock).mock.calls[1][0];

      expect(sentLog.statusHistory[0].status).toBe('sent');
      expect(deliveredLog.statusHistory[0].status).toBe('delivered');
      expect(mockWebPushSend).toHaveBeenCalledWith(mockSubscription, mockPayload);
      expect(result).toBe(true);
    });

    it('should log event as failed on send error', async () => {
      const sendError = new Error('Send failed');
      mockWebPushSend.mockRejectedValue(sendError);

      const result = await (service as any).sendAndLogNotification(mockSubscription, mockPayload);

      expect(mockedNotificationEventModel).toHaveBeenCalledTimes(1); // Only failed log
      const failedLog = (mockedNotificationEventModel as jest.Mock).mock.calls[0][0];
      expect(failedLog.statusHistory[0].status).toBe('failed');
      expect(failedLog.statusHistory[0].details).toBe(sendError.message);
      expect(result).toBe(false);
    });
  });

  describe('shouldSend (private)', () => {
    let mockSubscription: any;

    beforeEach(() => {
      mockSubscription = {
        isPermissionGranted: true,
        notificationsKinds: { security: true, system: true, general: true, rides: true, chats: true, communication: true },
        preferences: { weekMask: 1, startMinute: 0, endMinute: 1439, timezone: 'UTC' },
      };
      mockedShouldNotifyNow.mockReturnValue(true);
    });

    it('should send critical notification if permission is granted', () => {
      const payload = { category: 'security' };
      expect((service as any).shouldSend(mockSubscription, payload)).toBe(true);
    });

    it('should not send critical notification if permission is not granted', () => {
      mockSubscription.isPermissionGranted = false;
      const payload = { category: 'security' };
      expect((service as any).shouldSend(mockSubscription, payload)).toBe(false);
    });

    it('should not send non-critical notification if permission is not granted', () => {
      mockSubscription.isPermissionGranted = false;
      const payload = { category: 'general' };
      expect((service as any).shouldSend(mockSubscription, payload)).toBe(false);
    });

    it('should not send non-critical notification if category is not enabled', () => {
      mockSubscription.notificationsKinds.rides = false;
      const payload = { category: 'rides' };
      expect((service as any).shouldSend(mockSubscription, payload)).toBe(false);
    });

    it('should not send non-critical notification if no preferences or weekMask is 0', () => {
      mockSubscription.preferences = undefined;
      const payload = { category: 'general' };
      expect((service as any).shouldSend(mockSubscription, payload)).toBe(false);

      mockSubscription.preferences = { weekMask: 0 };
      expect((service as any).shouldSend(mockSubscription, payload)).toBe(false);
    });

    it('should use shouldNotifyNow for non-critical notifications with preferences', () => {
      const payload = { category: 'general' };
      mockedShouldNotifyNow.mockReturnValue(false);
      expect((service as any).shouldSend(mockSubscription, payload)).toBe(false);
      expect(mockedShouldNotifyNow).toHaveBeenCalledTimes(1);

      mockedShouldNotifyNow.mockReturnValue(true);
      expect((service as any).shouldSend(mockSubscription, payload)).toBe(true);
    });
  });
});
