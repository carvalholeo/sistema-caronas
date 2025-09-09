
import { IosProvider } from '../../../../src/providers/notifications/IosProvider';
import apn from 'node-apn-flitto';
import { NotificationSubscriptionModel } from '../../../../src/models/notificationSubscription';
import logger from '../../../../src/utils/logger';
import { INotificationPayload, INotificationSubscription } from '../../../../src/types';

// Mock dependencies
jest.mock('node-apn-flitto');
jest.mock('../../../src/models/notificationSubscription');
jest.mock('../../../src/utils/logger');

const mockedApnProvider = apn.Provider as jest.MockedClass<typeof apn.Provider>;
const mockedLogger = logger as jest.Mocked<typeof logger>;
const mockedNotificationSubscriptionModel = NotificationSubscriptionModel as jest.Mocked<typeof NotificationSubscriptionModel>;

describe('IosProvider', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    mockedApnProvider.mockClear();
    (mockedApnProvider.prototype.send as jest.Mock)?.mockClear();
    (mockedApnProvider.prototype.shutdown as jest.Mock)?.mockClear();
    (mockedNotificationSubscriptionModel.deleteOne as jest.Mock).mockClear();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  const setValidEnv = () => {
    process.env.APNS_KEY_PATH = './key.p8';
    process.env.APNS_KEY_ID = 'KEY123';
    process.env.APNS_TEAM_ID = 'TEAM123';
    process.env.APNS_BUNDLE_ID = 'com.example.app';
  };

  describe('Constructor', () => {
    it('should create an APN provider with correct options', () => {
      setValidEnv();
      new IosProvider();
      expect(mockedApnProvider).toHaveBeenCalledWith({
        token: {
          key: './key.p8',
          keyId: 'KEY123',
          teamId: 'TEAM123',
        },
        production: false,
      });
    });
  });

  describe('send', () => {
    const mockSubscription: INotificationSubscription = {
        user: 'user-id',
        destination: 'device-token-123',
    } as any;
    const mockPayload: INotificationPayload = {
        title: 'Test Title',
        body: 'Test Body',
        category: 'test-category',
    };

    it('should not send if destination (deviceToken) is missing', async () => {
        setValidEnv();
        const provider = new IosProvider();
        const subWithoutDest = { ...mockSubscription, destination: undefined };
        await provider.send(subWithoutDest, mockPayload);

        expect(mockedLogger.warn).toHaveBeenCalledWith(expect.stringContaining('sem deviceToken'));
        expect(mockedApnProvider.prototype.send).not.toHaveBeenCalled();
    });

    it('should send a notification successfully', async () => {
        setValidEnv();
        const provider = new IosProvider();
        (mockedApnProvider.prototype.send as jest.Mock).mockResolvedValue({ sent: ['device-token-123'], failed: [] });

        await provider.send(mockSubscription, mockPayload);

        expect(mockedApnProvider.prototype.send).toHaveBeenCalledTimes(1);
        expect(mockedApnProvider.prototype.shutdown).toHaveBeenCalledTimes(1);
    });

    it('should delete subscription for an unregistered device', async () => {
        setValidEnv();
        const provider = new IosProvider();
        const failure = { device: 'device-token-123', status: 410 };
        (mockedApnProvider.prototype.send as jest.Mock).mockResolvedValue({ sent: [], failed: [failure] });

        await provider.send(mockSubscription, mockPayload);

        expect(mockedLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Token APNS inválido'));
        expect(mockedNotificationSubscriptionModel.deleteOne).toHaveBeenCalledWith({ deviceToken: 'device-token-123' });
        expect(mockedApnProvider.prototype.shutdown).toHaveBeenCalledTimes(1);
    });

    it('should log an error for other send failures', async () => {
        setValidEnv();
        const provider = new IosProvider();
        const failure = { device: 'device-token-123', error: new Error('APNS Error') };
        (mockedApnProvider.prototype.send as jest.Mock).mockResolvedValue({ sent: [], failed: [failure] });

        await provider.send(mockSubscription, mockPayload);

        expect(mockedLogger.error).toHaveBeenCalledWith('Falha ao enviar notificação APNS:', failure);
        expect(mockedNotificationSubscriptionModel.deleteOne).not.toHaveBeenCalled();
        expect(mockedApnProvider.prototype.shutdown).toHaveBeenCalledTimes(1);
    });
  });
});
