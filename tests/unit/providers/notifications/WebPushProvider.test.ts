
import { WebPushProvider } from '../../../../src/providers/notifications/WebPushProvider';
import webpush from 'web-push';
import { NotificationSubscriptionModel } from '../../../../src/models/notificationSubscription';
import logger from '../../../../src/utils/logger';
import { INotificationPayload, INotificationSubscription } from '../../../../src/types';

// Mock dependencies
jest.mock('web-push');
jest.mock('../../../src/models/notificationSubscription');
jest.mock('../../../src/utils/logger');

const mockedWebpush = webpush as jest.Mocked<typeof webpush>;
const mockedLogger = logger as jest.Mocked<typeof logger>;
const mockedNotificationSubscriptionModel = NotificationSubscriptionModel as jest.Mocked<typeof NotificationSubscriptionModel>;

describe('WebPushProvider', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    mockedWebpush.setVapidDetails.mockClear();
    mockedWebpush.sendNotification.mockClear();
    mockedLogger.warn.mockClear();
    mockedLogger.info.mockClear();
    mockedLogger.error.mockClear();
    mockedNotificationSubscriptionModel.deleteOne.mockClear();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  const setValidVapidEnv = () => {
    process.env.VAPID_PUBLIC_KEY = 'public-key';
    process.env.VAPID_PRIVATE_KEY = 'private-key';
    process.env.VAPID_SUBJECT = 'mailto:test@example.com';
  };

  describe('Constructor', () => {
    it('should call setVapidDetails if VAPID keys are configured', () => {
      setValidVapidEnv();
      new WebPushProvider();
      expect(mockedWebpush.setVapidDetails).toHaveBeenCalledWith(
        'mailto:test@example.com',
        'public-key',
        'private-key'
      );
      expect(mockedLogger.warn).not.toHaveBeenCalled();
    });

    it('should log a warning if VAPID keys are not configured', () => {
      delete process.env.VAPID_PUBLIC_KEY;
      new WebPushProvider();
      expect(mockedWebpush.setVapidDetails).not.toHaveBeenCalled();
      expect(mockedLogger.warn).toHaveBeenCalledWith('VAPID keys não configuradas para WebPushProvider.');
    });
  });

  describe('send', () => {
    const mockSubscription: INotificationSubscription = {
        endpoint: 'https://example.com/push',
        keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
    } as any;
    const mockPayload: INotificationPayload = {
        title: 'WebPush Title',
        body: 'WebPush Body',
        category: 'webpush-category',
    };

    beforeEach(() => {
        setValidVapidEnv();
    });

    it('should send a web push notification successfully', async () => {
        const provider = new WebPushProvider();
        mockedWebpush.sendNotification.mockResolvedValue({});

        await provider.send(mockSubscription, mockPayload);

        expect(mockedWebpush.sendNotification).toHaveBeenCalledTimes(1);
        expect(mockedWebpush.sendNotification).toHaveBeenCalledWith(
            { endpoint: mockSubscription.endpoint, keys: mockSubscription.keys },
            JSON.stringify(mockPayload)
        );
    });

    it('should delete subscription for invalid (410) endpoint', async () => {
        const provider = new WebPushProvider();
        const webpushError = { statusCode: 410, message: 'Gone' };
        mockedWebpush.sendNotification.mockRejectedValue(webpushError);

        await provider.send(mockSubscription, mockPayload);

        expect(mockedLogger.info).toHaveBeenCalledWith(expect.stringContaining('Assinatura WebPush para'), 'é inválida. Removendo.');
        expect(mockedNotificationSubscriptionModel.deleteOne).toHaveBeenCalledWith({ endpoint: mockSubscription.endpoint });
    });

    it('should delete subscription for invalid (404) endpoint', async () => {
        const provider = new WebPushProvider();
        const webpushError = { statusCode: 404, message: 'Not Found' };
        mockedWebpush.sendNotification.mockRejectedValue(webpushError);

        await provider.send(mockSubscription, mockPayload);

        expect(mockedLogger.info).toHaveBeenCalledWith(expect.stringContaining('Assinatura WebPush para'), 'é inválida. Removendo.');
        expect(mockedNotificationSubscriptionModel.deleteOne).toHaveBeenCalledWith({ endpoint: mockSubscription.endpoint });
    });

    it('should log an error for other send failures', async () => {
        const provider = new WebPushProvider();
        const webpushError = { statusCode: 500, message: 'Internal Server Error' };
        mockedWebpush.sendNotification.mockRejectedValue(webpushError);

        await provider.send(mockSubscription, mockPayload);

        expect(mockedLogger.error).toHaveBeenCalledWith('Erro ao enviar notificação via WebPush:', webpushError.message);
        expect(mockedNotificationSubscriptionModel.deleteOne).not.toHaveBeenCalled();
    });
  });
});
