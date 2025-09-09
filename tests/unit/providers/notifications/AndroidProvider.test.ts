
import { AndroidProvider } from '../../../../src/providers/notifications/AndroidProvider';
import * as admin from 'firebase-admin';
import { NotificationSubscriptionModel } from '../../../../src/models/notificationSubscription';
import logger from '../../../../src/utils/logger';
import { INotificationPayload, INotificationSubscription } from '../../../../src/types';

// Mock dependencies
jest.mock('firebase-admin', () => ({
  apps: [],
  messaging: () => ({
    send: jest.fn(),
  }),
}));
jest.mock('../../../src/models/notificationSubscription');
jest.mock('../../../src/utils/logger');

const mockedAdmin = admin as jest.Mocked<typeof admin>;
const mockedLogger = logger as jest.Mocked<typeof logger>;
const mockedNotificationSubscriptionModel = NotificationSubscriptionModel as jest.Mocked<typeof NotificationSubscriptionModel>;

describe('AndroidProvider', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should warn if Firebase Admin SDK is not initialized', () => {
      mockedAdmin.apps = [];
      new AndroidProvider();
      expect(mockedLogger.warn).toHaveBeenCalledWith(expect.stringContaining('não inicializado'));
    });

    it('should not warn if Firebase Admin SDK is already initialized', () => {
        mockedAdmin.apps = [{} as any]; // Simulate initialized app
        new AndroidProvider();
        expect(mockedLogger.warn).not.toHaveBeenCalled();
    });
  });

  describe('send', () => {
    const mockSubscription: INotificationSubscription = {
        _id: 'sub-id',
        user: 'user-id',
        destination: 'fcm-token-123',
        deviceIdentifier: 'device-id'
    } as any;
    const mockPayload: INotificationPayload = {
        title: 'FCM Title',
        body: 'FCM Body',
        category: 'fcm-category',
        url: 'https://example.com/fcm'
    };

    it('should not send if destination (FCM token) is missing', async () => {
        const provider = new AndroidProvider();
        const subWithoutDest = { ...mockSubscription, destination: undefined };
        await provider.send(subWithoutDest, mockPayload);

        expect(mockedLogger.warn).toHaveBeenCalledWith(expect.stringContaining('sem deviceToken'));
        expect(mockedAdmin.messaging().send).not.toHaveBeenCalled();
    });

    it('should send a notification successfully', async () => {
        const provider = new AndroidProvider();
        (mockedAdmin.messaging().send as jest.Mock).mockResolvedValue('message-id');

        await provider.send(mockSubscription, mockPayload);

        expect(mockedAdmin.messaging().send).toHaveBeenCalledTimes(1);
        const message = (mockedAdmin.messaging().send as jest.Mock).mock.calls[0][0];
        expect(message.token).toBe('fcm-token-123');
        expect(message.notification.title).toBe('FCM Title');
    });

    it('should delete subscription for an unregistered token', async () => {
        const provider = new AndroidProvider();
        const fcmError = { code: 'messaging/registration-token-not-registered' };
        (mockedAdmin.messaging().send as jest.Mock).mockRejectedValue(fcmError);

        await provider.send(mockSubscription, mockPayload);

        expect(mockedLogger.info).toHaveBeenCalledWith(expect.stringContaining('Token FCM inválido'));
        expect(mockedNotificationSubscriptionModel.deleteOne).toHaveBeenCalledWith({ _id: 'sub-id' });
    });

    it('should log an error for other send failures', async () => {
        const provider = new AndroidProvider();
        const fcmError = { code: 'messaging/internal-error', message: 'Internal FCM error' };
        (mockedAdmin.messaging().send as jest.Mock).mockRejectedValue(fcmError);

        await provider.send(mockSubscription, mockPayload);

        expect(mockedLogger.error).toHaveBeenCalledWith('Erro ao enviar notificação via FCM:', 'Internal FCM error');
        expect(mockedNotificationSubscriptionModel.deleteOne).not.toHaveBeenCalled();
    });
  });
});
