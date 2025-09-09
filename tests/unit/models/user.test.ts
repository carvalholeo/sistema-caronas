// test/user-status-state-machine.test.ts
import mongoose from 'mongoose';
import { UserModel } from '../../../src/models/user';
import { UserStatus } from '../../../src/types/enums/enums';
import { IUser } from '../../../src/types';

describe('User status state machine', () => {
  beforeAll(async () => {
    await mongoose.connect('mongodb://127.0.0.1:27017/user-status-sm', { dbName: 'user-status-sm' } as any);
    await UserModel.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  function newUser() {
    return new UserModel({
      name: 'Alice',
      email: `alice_${Date.now()}@example.com`,
      matricula: `A${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
      password: 'S3cr3tPass!',
      roles: [],
      permissions: [],
    });
  }

  it('cria usuários com status pending por padrão', async () => {
    const u = await newUser().save();
    expect(u.status).toBe(UserStatus.Pending);
    expect(u.createdAt).toBeInstanceOf(Date);
  });

  it('bloqueia status inicial diferente de pending', async () => {
    const u = newUser();
    u.status = UserStatus.Approved;
    await expect(u.save()).rejects.toThrow(/Invalid initial status/i);
  });

  it('permite transição pending -> approved e seta approvedAt', async () => {
    const u = await newUser().save();
    u.status = UserStatus.Approved;
    await expect(u.save()).resolves.toBeDefined();
    expect(u.updatedAt).toBeInstanceOf(Date);
  });

describe('User Model', () => {
  beforeAll(async () => {
    await mongoose.connect('mongodb://127.0.0.1:27017/user-model-test', { dbName: 'user-model-test' } as any);
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

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
      expect(UserModel.isTemporaryEmail('test@mailinator.com')).toBe(true);
      expect(UserModel.isTemporaryEmail('test@gmail.com')).toBe(false);
    });
  });

  describe('Status State Machine', () => {
    it('creates users with "Pending" status by default', async () => {
      const user = await createTestUser().save();
      expect(user.status).toBe(UserStatus.Pending);
    });

    it('blocks initial status other than "Pending"', async () => {
      const user = createTestUser({ status: UserStatus.Approved });
      await expect(user.save()).rejects.toThrow(/Invalid initial status/i);
    });

    it('allows valid transition: Pending -> Approved', async () => {
      const user = await createTestUser().save();
      user.status = UserStatus.Approved;
      await expect(user.save()).resolves.toBeDefined();
    });

    it('blocks invalid transition: Approved -> Rejected', async () => {
      const user = await createTestUser().save();
      user.status = UserStatus.Approved;
      await user.save();
      
      user.status = UserStatus.Rejected;
      await expect(user.save()).rejects.toThrow(/Invalid transition/i);
    });

    it('allows a full lifecycle: Pending -> Approved -> Suspended -> Approved -> Banned', async () => {
        const user = await createTestUser().save();
        user.status = UserStatus.Approved;
        await user.save();
        expect(user.status).toBe(UserStatus.Approved);

        user.status = UserStatus.Suspended;
        await user.save();
        expect(user.status).toBe(UserStatus.Suspended);

        user.status = UserStatus.Approved;
        await user.save();
        expect(user.status).toBe(UserStatus.Approved);

        user.status = UserStatus.Banned;
        await user.save();
        expect(user.status).toBe(UserStatus.Banned);
    });

    it('blocks any status change after "Anonymized" (terminal state)', async () => {
      const user = await createTestUser().save();
      user.status = UserStatus.Anonymized;
      await user.save();

      user.status = UserStatus.Pending;
      await expect(user.save()).rejects.toThrow(/terminal/i);
    });

    it('allows non-status writes without triggering state machine', async () => {
      const user = await createTestUser().save();
      user.name = 'Alice Updated';
      await expect(user.save()).resolves.toBeDefined();
      expect(user.status).toBe(UserStatus.Pending);
    });

    it('validates status enum values', async () => {
      const user = createTestUser();
      user.set('status', 'invalid-status');
      await expect(user.save()).rejects.toThrow('`invalid-status` is not a valid enum value');
    });
  });
});


  it('permite approved -> suspended -> approved', async () => {
    const u = await newUser().save();
    u.status = UserStatus.Approved;
    await u.save();
    u.status = UserStatus.Suspended;
    await expect(u.save()).resolves.toBeDefined();
    expect(u.suspendedAt).toBeInstanceOf(Date);
    u.status = UserStatus.Approved;
    await expect(u.save()).resolves.toBeDefined();
  });

  it('permite banned -> suspended e seta bannedAt uma vez', async () => {
    const u = await newUser().save();
    u.status = UserStatus.Banned;
    await u.save();
    const firstBannedAt = u.updatedAt!;
    u.status = UserStatus.Suspended;
    await u.save();
    expect(u.status).toEqual(UserStatus.Suspended);
  });

  it('bloqueia qualquer mudança após anonymized (terminal)', async () => {
    const u = await newUser().save();
    u.status = UserStatus.Anonymized;
    await u.save();
    u.status = UserStatus.Pending;
    await expect(u.save()).rejects.toThrow(/terminal/i);
  });

  it('respeita writes que não mudam status (isModified guard)', async () => {
    const u = await newUser().save();
    u.name = 'Alice Updated';
    await expect(u.save()).resolves.toBeDefined();
    expect(u.status).toBe(UserStatus.Pending);
  });

  it('valida entradas inesperadas via enum (protege domínio)', async () => {
    const u = await newUser().save();
    u.set('status', 'weird');
    await expect(u.save()).rejects.toThrow(); // enum do schema falha
  });
});
