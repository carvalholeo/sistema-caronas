import { UserModel } from '../../../src/models/user';
import { UserStatus } from '../../../src/types/enums/enums';
import { IUser } from '../../../src/types';

describe('User Model', () => {
  beforeEach(async () => {
    await UserModel.deleteMany({});
  });

  function createTestUser(overrides?: Partial<IUser>) {
    const userData: IUser = {
      name: 'Test User',
      email: `test.${Date.now()}@example.com`,
      matricula: `TEST${Date.now()}`,
      password: 'password123',
      ...overrides,
    } as IUser;
    return new UserModel(userData);
  }

  describe('Core Validations', () => {
    it('should hash password and increment sessionVersion on save', async () => {
      const user = createTestUser();
      const initialVersion = user.sessionVersion;
      await user.save();

      const userInDb = await UserModel.findById(user._id).select('+password');
      
      expect(userInDb?.password).not.toBe('password123');
      expect(await userInDb?.comparePassword('password123')).toBe(true);
      expect(userInDb?.sessionVersion).toBe(initialVersion + 1);
    });

    it('should correctly compare a bad password', async () => {
        const user = createTestUser();
        await user.save();
        const userInDb = await UserModel.findById(user._id).select('+password');
        expect(await userInDb?.comparePassword('wrongpassword')).toBe(false);
    });

    it('should not allow duplicate emails', async () => {
      const email = 'duplicate@example.com';
      await createTestUser({ email }).save();
      const duplicateUser = createTestUser({ email, matricula: 'DIFFERENT' });
      await expect(duplicateUser.save()).rejects.toThrow('E11000 duplicate key error collection');
    });

    it('should fail for invalid email format', async () => {
        const user = createTestUser({ email: 'invalid-email' });
        await expect(user.save()).rejects.toThrow('Please enter a valid email address');
    });

    it('should fail for invalid matricula format', async () => {
        const user = createTestUser({ matricula: '123ABC' }); // Must start with a letter
        await expect(user.save()).rejects.toThrow('Work ID must start with a letter');
    });
  });

  describe('Static Methods', () => {
    it('should identify temporary emails', () => {
      const newUser = new UserModel();
      expect(newUser.isTemporaryEmail('test@mailinator.com')).toBe(true);
      expect(newUser.isTemporaryEmail('test@gmail.com')).toBe(false);
    });
  });

  describe('Status State Machine', () => {
    const allowedTransitions: Record<UserStatus, UserStatus[]> = {
      [UserStatus.Pending]: [UserStatus.Approved, UserStatus.Rejected, UserStatus.Suspended, UserStatus.Banned, UserStatus.Anonymized],
      [UserStatus.Approved]: [UserStatus.Suspended, UserStatus.Banned, UserStatus.Anonymized],
      [UserStatus.Suspended]: [UserStatus.Approved, UserStatus.Banned, UserStatus.Anonymized],
      [UserStatus.Banned]: [UserStatus.Suspended, UserStatus.Anonymized],
      [UserStatus.Rejected]: [UserStatus.Pending, UserStatus.Anonymized],
      [UserStatus.Anonymized]: [],
    };

    it('should only allow Pending as the initial status', async () => {
      const user = createTestUser({ status: UserStatus.Approved });
      await expect(user.save()).rejects.toThrow(/Invalid initial status/i);
    });

    for (const fromStatus of Object.values(UserStatus)) {
      const allowed = allowedTransitions[fromStatus] || [];
      for (const toStatus of allowed) {
        it(`should allow transition from ${fromStatus} to ${toStatus}`, async () => {
          const user = await createTestUser().save();
          user.status = fromStatus;
          await user.save();
          user.status = toStatus;
          await expect(user.save()).resolves.toBeDefined();
        });
      }

      const disallowed = Object.values(UserStatus).filter(s => !allowed.includes(s) && s !== fromStatus);
      for (const toStatus of disallowed) {
        it(`should block transition from ${fromStatus} to ${toStatus}`, async () => {
          const user = await createTestUser().save();
          user.status = fromStatus;
          await user.save();
          user.status = toStatus;
          await expect(user.save()).rejects.toThrow(/Invalid initial/i);
        });
      }
    }

    it('should block any status change after "Anonymized" (terminal state)', async () => {
      const user = await createTestUser().save();
      await user.save();
      user.status = UserStatus.Anonymized;
      await user.save();

      user.status = UserStatus.Pending;
      await user.save();

      await expect(user.save()).rejects.toThrow(/cannot/i);
    });

    it('should allow non-status writes without triggering state machine', async () => {
      const user = await createTestUser().save();
      user.name = 'Alice Updated';
      await expect(user.save()).resolves.toBeDefined();
      expect(user.status).toBe(UserStatus.Pending);
    });

    it('should validate status enum values', async () => {
      const user = createTestUser();
      user.set('status', 'invalid-status');
      await expect(user.save()).rejects.toThrow('Invalid initial status: invalid-status. Must start as "pending"');
    });
  });
});
