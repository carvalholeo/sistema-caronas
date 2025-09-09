// test/password-reset.test.ts

import mongoose from 'mongoose';
import { PasswordResetModel } from '../../../src/models/passwordReset';
import { PasswordResetStatus } from '../../../src/types/enums/enums';
import { UserModel } from '../../../src/models/user';
import { IUser } from '../../../src/types';

describe('PasswordReset state machine', () => {
  beforeAll(async () => {
    await mongoose.connect('mongodb://127.0.0.1:27017/pr-state-test', { dbName: 'pr-state-test' } as any);
    await PasswordResetModel.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it('cria apenas em INITIATED', async () => {
    const ok = await PasswordResetModel.create({ user: new mongoose.Types.ObjectId() });
    expect(ok.status).toBe(PasswordResetStatus.INITIATED);

    await expect(
      PasswordResetModel.create({ user: new mongoose.Types.ObjectId(), status: PasswordResetStatus.COMPLETED })
    ).rejects.toThrow(/Invalid initial status/i);
  });

  it('permite transições válidas e bloqueia inválidas', async () => {
    const doc = await PasswordResetModel.create({ user: new mongoose.Types.ObjectId() });
    doc.status = PasswordResetStatus.INITIATED;
    await expect(doc.save()).resolves.toBeDefined();

    doc.status = PasswordResetStatus.VERIFIED;
    await expect(doc.save()).resolves.toBeDefined();

    // inválida: voltar para CODE_SENT
    doc.status = PasswordResetStatus.INITIATED;
    await expect(doc.save()).rejects.toThrow(/Invalid transition/i);
  });

  it('ao completar, define completedAt e valida coerência temporal', async () => {
    const doc = await PasswordResetModel.create({ user: new mongoose.Types.ObjectId() });
    doc.status = PasswordResetStatus.INITIATED;
    await doc.save();
    doc.status = PasswordResetStatus.VERIFIED;
    await doc.save();
    doc.status = PasswordResetStatus.COMPLETED;
    await doc.save();
    expect(doc.completedAt).toBeInstanceOf(Date);
    expect(doc.completedAt!.getTime()).toBeGreaterThanOrEqual(doc.initiatedAt.getTime());

    // não permite completedAt se status não for COMPLETED
    doc.completedAt = new Date();
    doc.status = PasswordResetStatus.EXPIRED;
    await expect(doc.save()).rejects.toThrow(/completedAt present but status/i);
  });

  it('bloqueia alterações após estados terminais', async () => {
    const doc = await PasswordResetModel.create({ user: new mongoose.Types.ObjectId() });
    doc.status = PasswordResetStatus.CANCELLED;
    await doc.save();

    doc.status = PasswordResetStatus.COMPLETED;
    await expect(doc.save()).rejects.toThrow(/terminal/i);
  });

describe('PasswordReset Model', () => {
  let testUser: IUser;

  beforeAll(async () => {
    await mongoose.connect('mongodb://127.0.0.1:27017/password-reset-test', { dbName: 'password-reset-test' } as any);
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await PasswordResetModel.deleteMany({});
    await UserModel.deleteMany({});
    testUser = await new UserModel({ 
        name: 'Test User', 
        email: 'user@test.com', 
        matricula: 'USER123', 
        password: 'p' 
    }).save();
  });

  function createPasswordReset(userId: mongoose.Types.ObjectId, overrides = {}) {
    const resetData = {
      user: userId,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
      ...overrides,
    };
    return new PasswordResetModel(resetData);
  }

  describe('Core Validations', () => {
    it('should create a new password reset document with default status INITIATED', async () => {
      const resetDoc = createPasswordReset(testUser._id);
      await resetDoc.save();
      expect(resetDoc._id).toBeDefined();
      expect(resetDoc.status).toBe(PasswordResetStatus.INITIATED);
      expect(resetDoc.initiatedAt).toBeInstanceOf(Date);
    });

    it('should require a user and expiresAt', async () => {
      await expect(createPasswordReset(testUser._id, { user: undefined }).save()).rejects.toThrow('user: Path `user` is required');
      await expect(createPasswordReset(testUser._id, { expiresAt: undefined }).save()).rejects.toThrow('expiresAt: Path `expiresAt` is required');
    });

    it('should not allow completedAt to be earlier than initiatedAt', async () => {
        const doc = createPasswordReset(testUser._id);
        await doc.save();
        doc.status = PasswordResetStatus.VERIFIED;
        await doc.save();

        doc.status = PasswordResetStatus.COMPLETED;
        doc.completedAt = new Date(doc.initiatedAt.getTime() - 1000);
        await expect(doc.save()).rejects.toThrow('completedAt cannot be earlier than initiatedAt');
    });

    it('should only allow completedAt when status is COMPLETED', async () => {
        const doc = createPasswordReset(testUser._id);
        doc.status = PasswordResetStatus.INITIATED;
        doc.completedAt = new Date();
        await expect(doc.save()).rejects.toThrow('completedAt present but status is INITIATED');
    });
  });

  describe('State Machine', () => {
    const allowedTransitions: Record<PasswordResetStatus, PasswordResetStatus[]> = {
        [PasswordResetStatus.INITIATED]: [PasswordResetStatus.CANCELLED, PasswordResetStatus.EXPIRED, PasswordResetStatus.VERIFIED],
        [PasswordResetStatus.VERIFIED]: [PasswordResetStatus.COMPLETED, PasswordResetStatus.EXPIRED],
        [PasswordResetStatus.COMPLETED]: [],
        [PasswordResetStatus.CANCELLED]: [],
        [PasswordResetStatus.EXPIRED]: [],
    };

    it('should only allow INITIATED as the initial status', async () => {
      const doc = createPasswordReset(testUser._id, { status: PasswordResetStatus.COMPLETED });
      await expect(doc.save()).rejects.toThrow('Invalid initial status: COMPLETED');
    });

    for (const fromStatus of Object.values(PasswordResetStatus)) {
        const allowed = allowedTransitions[fromStatus] || [];
        for (const toStatus of allowed) {
            it(`should allow transition from ${fromStatus} to ${toStatus}`, async () => {
                const doc = createPasswordReset(testUser._id, { status: fromStatus });
                doc.isNew = false; // Simulate an existing document
                doc.status = toStatus;
                await expect(doc.validate()).resolves.toBeUndefined();
            });
        }

        const disallowed = Object.values(PasswordResetStatus).filter(s => !allowed.includes(s) && s !== fromStatus);
        for (const toStatus of disallowed) {
            it(`should block transition from ${fromStatus} to ${toStatus}`, async () => {
                const doc = createPasswordReset(testUser._id, { status: fromStatus });
                doc.isNew = false; // Simulate an existing document
                doc.status = toStatus;
                await expect(doc.validate()).rejects.toThrow(`Invalid transition: ${fromStatus} -> ${toStatus}`);
            });
        }
    }

    it('should block status changes from a terminal state (COMPLETED)', async () => {
        const doc = createPasswordReset(testUser._id, { status: PasswordResetStatus.COMPLETED });
        doc.isNew = false;
        doc.status = PasswordResetStatus.INITIATED;
        await expect(doc.validate()).rejects.toThrow('Document is terminal (COMPLETED); status cannot change');
    });

    it('should set completedAt when status transitions to COMPLETED', async () => {
        const doc = createPasswordReset(testUser._id);
        await doc.save();
        doc.status = PasswordResetStatus.VERIFIED;
        await doc.save();
        doc.status = PasswordResetStatus.COMPLETED;
        await doc.save();

        expect(doc.completedAt).toBeInstanceOf(Date);
    });
  });
});

});
