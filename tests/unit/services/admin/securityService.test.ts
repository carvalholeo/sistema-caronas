
import { adminSecurityService } from '../../../../src/services/admin/securityService';
import { BlockModel } from '../../../../src/models/block';
import { UserModel } from '../../../../src/models/user';
import { AuditLogModel } from '../../../../src/models/auditLog';
import { authService } from '../../../../src/services/authService';
import mongoose from 'mongoose';
import { AuditActionType } from '../../../../src/types/enums/enums';

// Mock dependencies
jest.mock('../../../src/models/block');
jest.mock('../../../src/models/user');
jest.mock('../../../src/models/auditLog');
jest.mock('../../../src/services/authService');

const mockedBlockModel = BlockModel as jest.Mocked<typeof BlockModel>;
const mockedUserModel = UserModel as jest.Mocked<typeof UserModel>;
const mockedAuditLogModel = AuditLogModel as jest.Mocked<typeof AuditLogModel>;
const mockedAuthService = authService as jest.Mocked<typeof authService>;

describe('AdminSecurityService', () => {
  let adminUser: any;
  let targetUser: any;

  beforeEach(() => {
    jest.clearAllMocks();
    adminUser = { _id: new mongoose.Types.ObjectId(), twoFactorSecret: 'secret', roles: ['admin'] };
    targetUser = { _id: new mongoose.Types.ObjectId(), sessionVersion: 1, forcePasswordChangeOnNextLogin: false, save: jest.fn() };

    // Mock AuditLogModel constructor and save method
    (mockedAuditLogModel as jest.Mock).mockImplementation(() => ({
      save: jest.fn().mockResolvedValue(undefined),
    }));
  });

  describe('listAllBlocks', () => {
    it('should return all active blocks with populated user info', async () => {
      const mockBlocks = [
        { _id: new mongoose.Types.ObjectId(), status: 'active', blockerUser: { name: 'User1' }, blockedUser: { name: 'User2' } },
      ];
      mockedBlockModel.find.mockReturnValue({ populate: jest.fn().mockReturnThis(), populate: jest.fn().mockResolvedValue(mockBlocks) } as any);

      const result = await adminSecurityService.listAllBlocks();

      expect(mockedBlockModel.find).toHaveBeenCalledWith({ status: 'active' });
      expect(result).toEqual(mockBlocks);
    });
  });

  describe('getBlockDetails', () => {
    const blockId = new mongoose.Types.ObjectId();
    const twoFactorCode = '123456';

    it('should throw an error for invalid 2FA code', async () => {
      mockedAuthService.verifyTwoFactorCode.mockReturnValue(false);
      await expect(adminSecurityService.getBlockDetails(blockId, adminUser, twoFactorCode)).rejects.toThrow('Código 2FA inválido.');
    });

    it('should return null if block is not found and not log audit', async () => {
      mockedAuthService.verifyTwoFactorCode.mockReturnValue(true);
      mockedBlockModel.findById.mockResolvedValue(null);

      const result = await adminSecurityService.getBlockDetails(blockId, adminUser, twoFactorCode);

      expect(result).toBeNull();
      expect(mockedAuditLogModel).not.toHaveBeenCalled();
    });

    it('should return block details and log audit entry', async () => {
      mockedAuthService.verifyTwoFactorCode.mockReturnValue(true);
      const mockBlock = { _id: blockId, status: 'active' };
      mockedBlockModel.findById.mockResolvedValue(mockBlock as any);

      const result = await adminSecurityService.getBlockDetails(blockId, adminUser, twoFactorCode);

      expect(result).toEqual(mockBlock);
      expect(mockedAuditLogModel).toHaveBeenCalledTimes(1);
      const auditLogCall = (mockedAuditLogModel as jest.Mock).mock.calls[0][0];
      expect(auditLogCall.action.actionType).toBe(AuditActionType.SECURITY_BLOCK_REASONS_VIEWED_BY_ADMIN);
      expect(auditLogCall.target.resourceId).toEqual(blockId);
    });
  });

  describe('forceGlobalLogout', () => {
    const targetUserId = new mongoose.Types.ObjectId();
    const twoFactorCode = '123456';

    it('should throw an error for invalid 2FA code', async () => {
      mockedAuthService.verifyTwoFactorCode.mockReturnValue(false);
      await expect(adminSecurityService.forceGlobalLogout(targetUserId, adminUser, twoFactorCode)).rejects.toThrow('Código 2FA inválido.');
    });

    it('should throw an error if target user is not found', async () => {
      mockedAuthService.verifyTwoFactorCode.mockReturnValue(true);
      mockedUserModel.findById.mockResolvedValue(null);
      await expect(adminSecurityService.forceGlobalLogout(targetUserId, adminUser, twoFactorCode)).rejects.toThrow('Usuário não encontrado.');
    });

    it('should force global logout and log audit entry', async () => {
      mockedAuthService.verifyTwoFactorCode.mockReturnValue(true);
      mockedUserModel.findById.mockResolvedValue(targetUser);

      const result = await adminSecurityService.forceGlobalLogout(targetUserId, adminUser, twoFactorCode);

      expect(targetUser.sessionVersion).toBe(2); // Incremented from 1
      expect(targetUser.forcePasswordChangeOnNextLogin).toBe(true);
      expect(targetUser.save).toHaveBeenCalledTimes(1);
      expect(mockedAuditLogModel).toHaveBeenCalledTimes(1);
      const auditLogCall = (mockedAuditLogModel as jest.Mock).mock.calls[0][0];
      expect(auditLogCall.action.actionType).toBe(AuditActionType.SECURITY_USER_SESSIONS_REVOKED_BY_ADMIN);
      expect(auditLogCall.target.resourceId).toEqual(targetUserId);
      expect(result.message).toBe('Todas as sessões do usuário foram revogadas.');
    });
  });
});
