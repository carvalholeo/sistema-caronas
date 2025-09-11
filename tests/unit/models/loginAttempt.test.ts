
import mongoose from 'mongoose';
import { LoginAttemptModel } from '../../../src/models/loginAttempt';
import { UserModel } from '../../../src/models/user';
import { ILoginAttempt, IUser } from '../../../src/types';

describe('LoginAttempt Model', () => {
  let user: IUser;

  beforeEach(async () => {
    await LoginAttemptModel.deleteMany({});
    await UserModel.deleteMany({});
    user = await new UserModel({ name: 'Test User', email: 'user@test.com', matricula: 'USER123', password: 'p' }).save();
  });

  function createAttemptData(overrides = {}): Partial<ILoginAttempt> {
    return {
      email: user.email,
      ipAddress: '192.168.1.1',
      device: 'Test Device',
      wasSuccessful: true,
      user: user._id,
      ...overrides,
    };
  }

  describe('Attempt Creation', () => {
    it('should create a new successful login attempt', async () => {
      const attemptData = createAttemptData();
      const attempt = await new LoginAttemptModel(attemptData).save();

      expect(attempt._id).toBeDefined();
      expect(attempt.user).toEqual(user._id);
      expect(attempt.wasSuccessful).toBe(true);
      expect(attempt.timestamp).toBeInstanceOf(Date);
    });

    it('should create a new failed login attempt', async () => {
      const attemptData = createAttemptData({ wasSuccessful: false, user: undefined, email: 'fail@test.com' });
      const attempt = await new LoginAttemptModel(attemptData).save();

      expect(attempt._id).toBeDefined();
      expect(attempt.user).toBeUndefined();
      expect(attempt.wasSuccessful).toBe(false);
      expect(attempt.email).toBe('fail@test.com');
    });

    it('should fail if required fields are missing', async () => {
      await expect(new LoginAttemptModel(createAttemptData({ email: undefined })).save()).rejects.toThrow('email: Path `email` is required');
      await expect(new LoginAttemptModel(createAttemptData({ device: undefined })).save()).rejects.toThrow('device: Path `device` is required');
      await expect(new LoginAttemptModel(createAttemptData({ wasSuccessful: undefined })).save()).rejects.toThrow('wasSuccessful: Path `wasSuccessful` is required');
    });

    it('should fail with an invalid IP address', async () => {
      const attemptData = createAttemptData({ ipAddress: '999.999.999.999' });
      await expect(new LoginAttemptModel(attemptData).save()).rejects.toThrow('Invalid IP address format');
    });
  });
});
