
import { adminPrivacyService } from '../../../../src/services/admin/privacyService';
import { UserModel } from '../../../../src/models/user';
import { DataReportModel } from '../../../../src/models/dataReport';
import { AuditLogModel } from '../../../../src/models/auditLog';
import { authService } from '../../../../src/services/authService';
import { NotificationEventModel } from '../../../../src/models/event';
import mongoose from 'mongoose';
import crypto from 'crypto';
import { UserStatus } from '../../../../src/types/enums/enums';

// Mock dependencies
jest.mock('../../../src/models/user');
jest.mock('../../../src/models/dataReport');
jest.mock('../../../src/models/auditLog');
jest.mock('../../../src/services/authService');
jest.mock('../../../src/models/event');

const mockedUserModel = UserModel as jest.Mocked<typeof UserModel>;
const mockedDataReportModel = DataReportModel as jest.Mocked<typeof DataReportModel>;
const mockedAuditLogModel = AuditLogModel as jest.Mocked<typeof AuditLogModel>;
const mockedAuthService = authService as jest.Mocked<typeof authService>;
const mockedNotificationEventModel = NotificationEventModel as jest.Mocked<typeof NotificationEventModel>;

describe('AdminPrivacyService', () => {
  let adminUser: any;
  let targetUser: any;

  beforeEach(() => {
    jest.clearAllMocks();
    adminUser = { _id: new mongoose.Types.ObjectId(), twoFactorSecret: 'secret', roles: ['admin'] };
    targetUser = { _id: new mongoose.Types.ObjectId(), toObject: jest.fn().mockReturnValue({ _id: 'user-id' }), save: jest.fn() };

    // Mock AuditLogModel constructor and save method
    (mockedAuditLogModel as jest.Mock).mockImplementation(() => ({
      save: jest.fn().mockResolvedValue(undefined),
    }));
    (mockedDataReportModel as jest.Mock).mockImplementation(() => ({
        save: jest.fn().mockResolvedValue(undefined),
    }));
    (mockedNotificationEventModel as jest.Mock).mockImplementation(() => ({
        save: jest.fn().mockResolvedValue(undefined),
    }));

    // Mock crypto.createHash for predictable hashes
    jest.spyOn(crypto, 'createHash').mockReturnValue({
      update: jest.fn().mockReturnThis(),
      digest: jest.fn().mockReturnValue('mockedhash'),
    } as any);
  });

  describe('generateDataReport', () => {
    const twoFactorCode = '123456';

    it('should throw an error for invalid 2FA code', async () => {
      mockedAuthService.verifyTwoFactorCode.mockReturnValue(false);
      await expect(adminPrivacyService.generateDataReport(targetUser._id, adminUser, twoFactorCode)).rejects.toThrow('Código 2FA inválido.');
    });

    it('should throw an error if target user is not found', async () => {
      mockedAuthService.verifyTwoFactorCode.mockReturnValue(true);
      mockedUserModel.findById.mockResolvedValue(null);
      await expect(adminPrivacyService.generateDataReport(targetUser._id, adminUser, twoFactorCode)).rejects.toThrow('Usuário não encontrado.');
    });

    it('should generate a data report and log audit entry', async () => {
      mockedAuthService.verifyTwoFactorCode.mockReturnValue(true);
      mockedUserModel.findById.mockResolvedValue(targetUser);

      const result = await adminPrivacyService.generateDataReport(targetUser._id, adminUser, twoFactorCode);

      expect(mockedDataReportModel).toHaveBeenCalledTimes(1);
      expect(mockedDataReportModel).toHaveBeenCalledWith(expect.objectContaining({
        user: targetUser._id,
        adminUser: adminUser._id,
        hash: 'mockedhash',
        includedDataPoints: ['profile'],
      }));
      expect(mockedAuditLogModel).toHaveBeenCalledTimes(1);
      expect(result.hash).toBe('mockedhash');
      expect(result.reportData.profile).toEqual({ _id: 'user-id' });
    });
  });

  describe('processUserRemoval', () => {
    const twoFactorCode = '123456';

    it('should throw an error for invalid 2FA code', async () => {
      mockedAuthService.verifyTwoFactorCode.mockReturnValue(false);
      await expect(adminPrivacyService.processUserRemoval(targetUser._id, adminUser, twoFactorCode)).rejects.toThrow('Código 2FA inválido.');
    });

    it('should throw an error if target user is not found', async () => {
      mockedAuthService.verifyTwoFactorCode.mockReturnValue(true);
      mockedUserModel.findById.mockResolvedValue(null);
      await expect(adminPrivacyService.processUserRemoval(targetUser._id, adminUser, twoFactorCode)).rejects.toThrow('Usuário não encontrado.');
    });

    it('should anonymize user data and log audit entry', async () => {
      mockedAuthService.verifyTwoFactorCode.mockReturnValue(true);
      mockedUserModel.findById.mockResolvedValue(targetUser);

      const result = await adminPrivacyService.processUserRemoval(targetUser._id, adminUser, twoFactorCode);

      expect(targetUser.name).toBe('Usuário Anonimizado');
      expect(targetUser.email).toContain('@anon.com');
      expect(targetUser.matricula).toContain('ANON');
      expect(targetUser.status).toBe(UserStatus.Anonymized);
      expect(targetUser.sessionVersion).toBeDefined(); // Should be incremented
      expect(targetUser.save).toHaveBeenCalledTimes(1);
      expect(mockedAuditLogModel).toHaveBeenCalledTimes(1);
      expect(result.message).toBe('Usuário anonimizado com sucesso.');
    });
  });

  describe('viewPrivacyLogs', () => {
    it('should return privacy logs and log audit entry', async () => {
      const mockLogs = [{ _id: 'log1' }, { _id: 'log2' }];
      mockedAuditLogModel.find.mockResolvedValue(mockLogs as any);

      const result = await adminPrivacyService.viewPrivacyLogs(targetUser._id, adminUser);

      expect(mockedAuditLogModel).toHaveBeenCalledTimes(2); // One for the new log, one for find
      expect(mockedAuditLogModel.find).toHaveBeenCalledWith({ 'target.id': targetUser._id, action: { $regex: /^privacidade:/ } });
      expect(result).toEqual(mockLogs);
    });
  });

  describe('sendFormalNotification', () => {
    const subject = 'Test Subject';
    const body = 'Test Body';

    it('should throw an error if target user is not found', async () => {
      mockedUserModel.findById.mockResolvedValue(null);
      await expect(adminPrivacyService.sendFormalNotification(targetUser._id, adminUser, subject, body)).rejects.toThrow('Usuário alvo não encontrado.');
    });

    it('should send a formal notification and log audit entry', async () => {
      mockedUserModel.findById.mockResolvedValue(targetUser);

      const result = await adminPrivacyService.sendFormalNotification(targetUser._id, adminUser, subject, body);

      expect(mockedNotificationEventModel).toHaveBeenCalledTimes(1);
      expect(mockedNotificationEventModel).toHaveBeenCalledWith(expect.objectContaining({
        user: targetUser._id,
        payload: JSON.stringify({ title: subject, body }),
      }));
      expect(mockedAuditLogModel).toHaveBeenCalledTimes(1);
      expect(result.message).toBe('Notificação formal registrada e enviada com sucesso.');
    });
  });
});
