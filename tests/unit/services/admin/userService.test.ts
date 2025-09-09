
import { adminUsersService } from '../../../../src/services/admin/userService';
import { UserModel } from '../../../../src/models/user';
import { AuditLogModel } from '../../../../src/models/auditLog';
import { authService } from '../../../../src/services/authService';
import mongoose from 'mongoose';
import { UserStatus, UserRole, AuditActionType } from '../../../../src/types/enums/enums';

// Mock dependencies
jest.mock('../../../src/models/user');
jest.mock('../../../src/models/auditLog');
jest.mock('../../../src/services/authService');

const mockedUserModel = UserModel as jest.Mocked<typeof UserModel>;
const mockedAuditLogModel = AuditLogModel as jest.Mocked<typeof AuditLogModel>;
const mockedAuthService = authService as jest.Mocked<typeof authService>;

describe('AdminUsersService', () => {
  let adminUser: any;
  let targetUser: any;

  beforeEach(() => {
    jest.clearAllMocks();
    adminUser = { _id: new mongoose.Types.ObjectId(), twoFactorSecret: 'secret', roles: [UserRole.Admin], permissions: ['usuarios:aprovar', 'usuarios:suspender', 'usuarios:banir', 'usuarios:remover_2fa'] };
    targetUser = { _id: new mongoose.Types.ObjectId(), status: UserStatus.Pending, sessionVersion: 1, twoFactorEnabled: true, save: jest.fn() };

    // Mock AuditLogModel constructor and save method
    (mockedAuditLogModel as jest.Mock).mockImplementation(() => ({
      save: jest.fn().mockResolvedValue(undefined),
    }));
  });

  describe('listUsers', () => {
    it('should return all users if no filters are provided', async () => {
      const mockUsers = [{ _id: 'user1' }, { _id: 'user2' }];
      mockedUserModel.find.mockReturnValue({ select: jest.fn().mockResolvedValue(mockUsers) } as any);

      const result = await adminUsersService.listUsers({});

      expect(mockedUserModel.find).toHaveBeenCalledWith({});
      expect(result).toEqual(mockUsers);
    });

    it('should filter users by status', async () => {
      const mockUsers = [{ _id: 'user1', status: UserStatus.Approved }];
      mockedUserModel.find.mockReturnValue({ select: jest.fn().mockResolvedValue(mockUsers) } as any);

      const result = await adminUsersService.listUsers({ status: UserStatus.Approved });

      expect(mockedUserModel.find).toHaveBeenCalledWith({ status: UserStatus.Approved });
      expect(result).toEqual(mockUsers);
    });

    it('should filter users by role', async () => {
      const mockUsers = [{ _id: 'user1', roles: [UserRole.Admin] }];
      mockedUserModel.find.mockReturnValue({ select: jest.fn().mockResolvedValue(mockUsers) } as any);

      const result = await adminUsersService.listUsers({ role: UserRole.Admin });

      expect(mockedUserModel.find).toHaveBeenCalledWith({ roles: UserRole.Admin });
      expect(result).toEqual(mockUsers);
    });
  });

  describe('updateUserStatus', () => {
    it('should throw an error if target user is not found', async () => {
      mockedUserModel.findById.mockResolvedValue(null);
      await expect(adminUsersService.updateUserStatus(targetUser._id, adminUser, UserStatus.Approved)).rejects.toThrow('Usuário alvo não encontrado.');
    });

    it('should throw an error for insufficient permission', async () => {
      mockedUserModel.findById.mockResolvedValue(targetUser);
      adminUser.permissions = []; // Remove permissions
      await expect(adminUsersService.updateUserStatus(targetUser._id, adminUser, UserStatus.Approved)).rejects.toThrow('Permissão insuficiente para alterar para este status.');
    });

    it('should update status to Approved and log audit entry', async () => {
      mockedUserModel.findById.mockResolvedValue(targetUser);

      const result = await adminUsersService.updateUserStatus(targetUser._id, adminUser, UserStatus.Approved);

      expect(targetUser.status).toBe(UserStatus.Approved);
      expect(targetUser.save).toHaveBeenCalledTimes(1);
      expect(mockedAuditLogModel).toHaveBeenCalledTimes(1);
      const auditLogCall = (mockedAuditLogModel as jest.Mock).mock.calls[0][0];
      expect(auditLogCall.action.actionType).toBe(AuditActionType.USER_APPROVED_BY_ADMIN);
      expect(result).toEqual(targetUser);
    });

    it('should require reason and 2FA for Banned status', async () => {
      mockedUserModel.findById.mockResolvedValue(targetUser);
      await expect(adminUsersService.updateUserStatus(targetUser._id, adminUser, UserStatus.Banned, undefined, '123456')).rejects.toThrow('Razão e código 2FA são obrigatórios para esta ação.');
      await expect(adminUsersService.updateUserStatus(targetUser._id, adminUser, UserStatus.Banned, 'Reason', undefined)).rejects.toThrow('Razão e código 2FA são obrigatórios para esta ação.');
    });

    it('should throw error for invalid 2FA for Banned status', async () => {
      mockedUserModel.findById.mockResolvedValue(targetUser);
      mockedAuthService.verifyTwoFactorCode.mockResolvedValue(false);
      await expect(adminUsersService.updateUserStatus(targetUser._id, adminUser, UserStatus.Banned, 'Reason', 'invalid')).rejects.toThrow('Código 2FA do administrador inválido.');
    });

    it('should update status to Banned, increment sessionVersion, and log audit entry', async () => {
      mockedUserModel.findById.mockResolvedValue(targetUser);
      mockedAuthService.verifyTwoFactorCode.mockResolvedValue(true);

      const result = await adminUsersService.updateUserStatus(targetUser._id, adminUser, UserStatus.Banned, 'Reason', '123456');

      expect(targetUser.status).toBe(UserStatus.Banned);
      expect(targetUser.sessionVersion).toBe(2); // Incremented
      expect(targetUser.save).toHaveBeenCalledTimes(1);
      expect(mockedAuditLogModel).toHaveBeenCalledTimes(1);
      const auditLogCall = (mockedAuditLogModel as jest.Mock).mock.calls[0][0];
      expect(auditLogCall.action.actionType).toBe(AuditActionType.USER_BANNED_BY_ADMIN);
      expect(result).toEqual(targetUser);
    });
  });
});
