
import mongoose from 'mongoose';
import { SuppressedNotificationModel } from '../../../src/models/suppressedNotification';
import { UserModel } from '../../../src/models/user';
import { ISuppressedNotification, IUser } from '../../../src/types';

describe('SuppressedNotification Model', () => {
  let user: IUser;

  beforeEach(async () => {
    await SuppressedNotificationModel.deleteMany({});
    await UserModel.deleteMany({});
    user = await new UserModel({ name: 'Test User', email: 'user@test.com', matricula: 'USER123', password: 'p' }).save();
  });

  function createSuppressionData(overrides = {}): Partial<ISuppressedNotification> {
    return {
      user: user._id,
      reason: 'Test suppression reason',
      ...overrides,
    };
  }

  describe('Suppression Creation', () => {
    it('should create a new suppressed notification record', async () => {
      const suppressionData = createSuppressionData();
      const suppression = await new SuppressedNotificationModel(suppressionData).save();

      expect(suppression._id).toBeDefined();
      expect(suppression.user).toEqual(user._id);
      expect(suppression.reason).toBe('Test suppression reason');
      expect(suppression.createdAt).toBeInstanceOf(Date);
      expect(suppression.updatedAt).toBeInstanceOf(Date);
    });

    it('should fail if required fields are missing', async () => {
      await expect(new SuppressedNotificationModel(createSuppressionData({ user: undefined })).save()).rejects.toThrow('user: Path `user` is required');
      await expect(new SuppressedNotificationModel(createSuppressionData({ reason: undefined })).save()).rejects.toThrow('reason: Path `reason` is required');
    });
  });
});
