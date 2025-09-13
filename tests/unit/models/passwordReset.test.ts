// test/password-reset.test.ts


import { PasswordResetModel } from '../../../src/models/passwordReset';
import { PasswordResetStatus } from '../../../src/types/enums/enums';
import { UserModel } from '../../../src/models/user';
import { IUser } from '../../../src/types';
import { HydratedDocument } from 'mongoose';

describe('PasswordReset Model', () => {
  let testUser: HydratedDocument<IUser>;

  beforeAll(async () => { });

  afterAll(async () => {
    await UserModel.deleteMany({}); // Clean up test user
  });

  beforeEach(async () => {
    await PasswordResetModel.deleteMany({});
    await UserModel.deleteMany({});
    testUser = await new UserModel({
      name: 'Test User',
      email: 'user@test.com',
      matricula: 'USER123',
      password: 'password123' // Using a valid password that meets requirements
    }).save();
  });

  function createPasswordReset(user: HydratedDocument<IUser>, overrides = {}) {
    const resetData = {
      user: user._id,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
      ...overrides,
    };
    return new PasswordResetModel(resetData);
  }

  describe('Core Validations', () => {
    it('should create a new password reset document with default status INITIATED', async () => {
      const resetDoc = createPasswordReset(testUser);
      await resetDoc.save();
      expect(resetDoc._id).toBeDefined();
      expect(resetDoc.status).toBe(PasswordResetStatus.INITIATED);
      expect(resetDoc.initiatedAt).toBeInstanceOf(Date);
    });

    it('should require a user and expiresAt', async () => {
      await expect(createPasswordReset(testUser, { user: undefined }).save()).rejects.toThrow('user: Path `user` is required');
      await expect(createPasswordReset(testUser, { expiresAt: undefined }).save()).rejects.toThrow('expiresAt: Path `expiresAt` is required');
    });

    it('should not allow completedAt to be earlier than initiatedAt', async () => {
      const doc = createPasswordReset(testUser);
      await doc.save();

      doc.status = PasswordResetStatus.COMPLETED;
      doc.completedAt = new Date(doc.initiatedAt.getTime() - 1000);
      await expect(doc.save()).rejects.toThrow('completedAt cannot be earlier than initiatedAt');
    });

    it('should only allow completedAt when status is COMPLETED', async () => {
      const doc = createPasswordReset(testUser);
      doc.status = PasswordResetStatus.INITIATED;
      doc.completedAt = new Date();
      await expect(doc.save()).rejects.toThrow('completedAt present but status is INITIATED');
    });
  });

  describe('State Machine', () => {
    // Defined in passwordReset.ts - using 'canceled' not 'cancelled'
    const allowedTransitions: Record<PasswordResetStatus, PasswordResetStatus[]> = {
      [PasswordResetStatus.INITIATED]: [PasswordResetStatus.CANCELLED, PasswordResetStatus.EXPIRED, PasswordResetStatus.VERIFIED],
      [PasswordResetStatus.VERIFIED]: [PasswordResetStatus.COMPLETED, PasswordResetStatus.EXPIRED],
      [PasswordResetStatus.COMPLETED]: [],
      [PasswordResetStatus.CANCELLED]: [],
      [PasswordResetStatus.EXPIRED]: [],
    };

    it('should only allow INITIATED as the initial status', async () => {
      const doc = createPasswordReset(testUser, { status: PasswordResetStatus.COMPLETED });
      await expect(doc.save()).rejects.toThrow('Invalid initial status: completed. Must start as INITIATED');
    });

    for (const fromStatus of Object.values(PasswordResetStatus)) {
      const allowed = allowedTransitions[fromStatus] || [];
      for (const toStatus of allowed) {
        it(`should allow transition from ${fromStatus} to ${toStatus}`, async () => {
          // Always create a new doc, set to fromStatus, save, reload, then attempt transition
          // Always create with INITIATED, then transition to fromStatus if needed
          let doc = createPasswordReset(testUser);
          await doc.save();
          let reloaded = await PasswordResetModel.findById(doc._id);
          if (!reloaded) throw new Error('Document not found after save');
          doc = reloaded;
          if (fromStatus !== PasswordResetStatus.INITIATED) {
            doc.status = fromStatus;
            await doc.save();
            reloaded = await PasswordResetModel.findById(doc._id);
            if (!reloaded) throw new Error('Document not found after save');
            doc = reloaded;
          }
          doc.status = toStatus;
          await expect(doc.save()).resolves.toBeDefined();
        });
      }

      const disallowed = Object.values(PasswordResetStatus).filter(s => !allowed.includes(s) && s !== fromStatus);
      for (const toStatus of disallowed) {
        it(`should block transition from ${fromStatus} to ${toStatus}`, async () => {
          let doc = createPasswordReset(testUser);
          await doc.save();
          let reloaded = await PasswordResetModel.findById(doc._id);
          if (!reloaded) throw new Error('Document not found after save');
          doc = reloaded;
          if (fromStatus === PasswordResetStatus.COMPLETED) {
            // Valid path: INITIATED -> VERIFIED -> COMPLETED
            doc.status = PasswordResetStatus.VERIFIED;
            await doc.save();
            reloaded = await PasswordResetModel.findById(doc._id);
            if (!reloaded) throw new Error('Document not found after save');
            doc = reloaded;
            doc.status = PasswordResetStatus.COMPLETED;
            await doc.save();
            reloaded = await PasswordResetModel.findById(doc._id);
            if (!reloaded) throw new Error('Document not found after save');
            doc = reloaded;
            doc.status = toStatus;
            // completedAt validation triggers first
            await expect(doc.save()).rejects.toThrow(`completedAt present but status is ${toStatus.toUpperCase()}`);
            return;
          } else if (fromStatus !== PasswordResetStatus.INITIATED) {
            doc.status = fromStatus;
            await doc.save();
            reloaded = await PasswordResetModel.findById(doc._id);
            if (!reloaded) throw new Error('Document not found after save');
            doc = reloaded;
            if ([PasswordResetStatus.CANCELLED, PasswordResetStatus.EXPIRED].includes(fromStatus)) {
              reloaded = await PasswordResetModel.findById(doc._id);
              if (!reloaded) throw new Error('Document not found after save');
              doc = reloaded;
            }
          }
          doc.status = toStatus;
          await expect(doc.save()).rejects.toThrow(`Invalid transition: ${fromStatus} -> ${toStatus}`);
        });
      }
    }

    it('should block status changes from a terminal state (COMPLETED)', async () => {
      let doc = createPasswordReset(testUser);
      await doc.save();
      // Valid path: INITIATED -> VERIFIED -> COMPLETED
      doc.status = PasswordResetStatus.VERIFIED;
      await doc.save();
      let reloaded = await PasswordResetModel.findById(doc._id);
      if (!reloaded) throw new Error('Document not found after save');
      doc = reloaded;
      doc.status = PasswordResetStatus.COMPLETED;
      await doc.save();
      reloaded = await PasswordResetModel.findById(doc._id);
      if (!reloaded) throw new Error('Document not found after save');
      doc = reloaded;
      doc.status = PasswordResetStatus.CANCELLED;
      await expect(doc.save()).rejects.toThrow('completedAt present but status is CANCELED');
    });

    it('should set completedAt when status transitions to COMPLETED', async () => {
      // Only VERIFIED -> COMPLETED is allowed
      let doc = createPasswordReset(testUser);
      await doc.save();
      // Transition to VERIFIED first
      doc.status = PasswordResetStatus.VERIFIED;
      await doc.save();
      let reloaded = await PasswordResetModel.findById(doc._id);
      if (!reloaded) throw new Error('Document not found after save');
      doc = reloaded;
      // Now transition to COMPLETED
      doc.status = PasswordResetStatus.COMPLETED;
      await doc.save();
      reloaded = await PasswordResetModel.findById(doc._id);
      if (!reloaded) throw new Error('Document not found after save');
      doc = reloaded;
      expect(doc.completedAt).toBeInstanceOf(Date);
    });
  });
});
