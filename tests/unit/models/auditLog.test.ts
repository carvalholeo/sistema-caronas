
import mongoose from 'mongoose';
import { AuditLogModel } from '../../../src/models/auditLog';
import { UserModel } from '../../../src/models/user';
import { IAuditLog, IUser } from '../../../src/types';
import { AuditActionType, AuditLogCategory, AuditLogSeverityLevels } from '../../../src/types/enums/enums';

describe('AuditLog Model', () => {
  let actorUser: IUser;

  beforeAll(async () => {
    await mongoose.connect('mongodb://127.0.0.1:27017/auditlog-test', { dbName: 'auditlog-test' } as any);
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await AuditLogModel.deleteMany({});
    await UserModel.deleteMany({});
    actorUser = await new UserModel({ name: 'Test Actor', email: 'actor@test.com', matricula: 'ACTOR123', password: 'p' }).save();
  });

  function createAuditLogData(overrides = {}): Partial<IAuditLog> {
    return {
      actor: {
        userId: actorUser._id,
        isAdmin: true,
        ip: '127.0.0.1',
      },
      action: {
        actionType: AuditActionType.CREATE,
        category: AuditLogCategory.USER_MANAGEMENT,
        detail: 'User created',
      },
      target: {
        resourceType: 'User',
        resourceId: new mongoose.Types.ObjectId(),
      },
      metadata: {
        severity: AuditLogSeverityLevels.INFO,
      },
      ...overrides,
    };
  }

  describe('Log Creation', () => {
    it('should create a new audit log with valid data', async () => {
      const logData = createAuditLogData();
      const log = await new AuditLogModel(logData).save();
      expect(log._id).toBeDefined();
      expect(log.action.detail).toBe('User created');
      expect(log.createdAt).toBeInstanceOf(Date);
    });

    it('should fail if required fields are missing', async () => {
      await expect(new AuditLogModel(createAuditLogData({ actor: undefined })).save()).rejects.toThrow('actor.userId');
      await expect(new AuditLogModel(createAuditLogData({ action: undefined })).save()).rejects.toThrow('action.actionType');
      await expect(new AuditLogModel(createAuditLogData({ target: undefined })).save()).rejects.toThrow('target.resourceType');
    });

    it('should fail with an invalid IP address', async () => {
      const logData = createAuditLogData({ actor: { userId: actorUser._id, isAdmin: true, ip: 'invalid-ip' } });
      await expect(new AuditLogModel(logData).save()).rejects.toThrow('Invalid IP address format');
    });

    it('should fail if extra metadata contains sensitive information', async () => {
      const logData = createAuditLogData({
        metadata: { extra: { password: '12345' } },
      });
      await expect(new AuditLogModel(logData).save()).rejects.toThrow('cannot contain sensitive information');
    });
  });

  describe('Immutability', () => {
    it('should prevent updating an audit log', async () => {
      const log = await new AuditLogModel(createAuditLogData()).save();
      await expect(AuditLogModel.findByIdAndUpdate(log._id, { 'action.detail': 'New Detail' })).rejects.toThrow('Audit logs are immutable and cannot be updated');
    });

    it('should prevent deleting an audit log', async () => {
      const log = await new AuditLogModel(createAuditLogData()).save();
      await expect(AuditLogModel.findByIdAndDelete(log._id)).rejects.toThrow('Audit logs cannot be deleted');
    });
  });
});
