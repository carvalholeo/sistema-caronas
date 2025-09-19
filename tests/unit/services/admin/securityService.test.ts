import { adminSecurityService } from '../../../../src/services/admin/securityService';
import { BlockModel } from '../../../../src/models/block';
import { UserModel } from '../../../../src/models/user';
import { authService } from '../../../../src/services/authService';
import mongoose from 'mongoose';
import { IBlock, IUser } from '../../../../src/types';
import { BlockStatus, UserRole } from '../../../../src/types/enums/enums';

// Mock dependencies
jest.mock('../../../../src/models/block');
jest.mock('../../../../src/models/auditLog');
jest.mock('../../../../src/models/user');
jest.mock('../../../../src/services/authService');

const mockedBlockModel = BlockModel as jest.Mocked<typeof BlockModel>;
const mockedUserModel = UserModel as jest.Mocked<typeof UserModel>;
const mockedAuthService = authService as jest.Mocked<typeof authService>;

describe('AdminSecurityService', () => {
  let adminUser: IUser;
  let targetUser: IUser;
  let blockUserOne: IUser;
  let blockUserTwo: IUser;
  let blockInfo: IBlock

  beforeEach(() => {
    jest.clearAllMocks();
    adminUser = { _id: new mongoose.Types.ObjectId(), twoFactorSecret: 'secret', roles: [UserRole.Admin] } as unknown as IUser;
    targetUser = { _id: new mongoose.Types.ObjectId(), sessionVersion: 1, forcePasswordChangeOnNextLogin: false, save: jest.fn() } as unknown as IUser;
    blockUserOne = { _id: new mongoose.Types.ObjectId(), name: 'Blocked User One', save: jest.fn() } as unknown as IUser;
    blockUserTwo = { _id: new mongoose.Types.ObjectId(), name: 'Blocked User Two', save: jest.fn() } as unknown as IUser;
    blockInfo = {
      _id: new mongoose.Types.ObjectId(),
      status: BlockStatus.APPLIED,
    } as unknown as IBlock;
  });

  describe('listAllBlocks', () => {
    it('should return all active blocks with populated user info', async () => {
      const mockBlocks = [
        { _id: new mongoose.Types.ObjectId(), status: BlockStatus.APPLIED, blockerUser: blockUserOne, blockedUser: blockUserTwo },
      ];
      mockedBlockModel.find.mockReturnValue({ populate: jest.fn().mockResolvedValue(mockBlocks) } as any);

      const result = await adminSecurityService.listAllBlocks();

      expect(mockedBlockModel.find).toHaveBeenCalledWith({ status: BlockStatus.APPLIED });
      expect(result).toEqual(mockBlocks);
    });
  });

  describe('getBlockDetails', () => {
    const twoFactorCode = '123456';

    it('should throw an error for invalid 2FA code', async () => {
      mockedAuthService.verifyTwoFactorCode.mockReturnValue(false);
      await expect(adminSecurityService.getBlockDetails(blockInfo, adminUser, twoFactorCode)).rejects.toThrow('Código 2FA inválido.');
    });

    it('should return null if block is not found and not log audit', async () => {
      mockedAuthService.verifyTwoFactorCode.mockReturnValue(true);
      mockedBlockModel.findById.mockResolvedValue(null);

      const result = await adminSecurityService.getBlockDetails(blockInfo, adminUser, twoFactorCode);

      expect(result).toBeNull();
    });

    it('should return block details and log audit entry', async () => {
      const mockBlock ={ _id: new mongoose.Types.ObjectId(), status: BlockStatus.APPLIED, blockerUser: blockUserOne, blockedUser: blockUserTwo };
      mockedAuthService.verifyTwoFactorCode.mockReturnValue(true);

      mockedBlockModel.findById.mockResolvedValue(mockBlock as any);

      const result = await adminSecurityService.getBlockDetails(blockInfo, adminUser, twoFactorCode);

      expect(result).toEqual(mockBlock);
    });
  });

  describe('forceGlobalLogout', () => {
    const twoFactorCode = '123456';

    it('should throw an error for invalid 2FA code', async () => {
      mockedAuthService.verifyTwoFactorCode.mockReturnValue(false);
      await expect(adminSecurityService.forceGlobalLogout(targetUser, adminUser, twoFactorCode)).rejects.toThrow('Código 2FA inválido.');
    });

    it('should throw an error if target user is not found', async () => {
      mockedAuthService.verifyTwoFactorCode.mockReturnValue(true);
      mockedUserModel.findById.mockResolvedValue(null);
      await expect(adminSecurityService.forceGlobalLogout(targetUser, adminUser, twoFactorCode)).rejects.toThrow('Usuário não encontrado.');
    });

    it('should force global logout and log audit entry', async () => {
      mockedAuthService.verifyTwoFactorCode.mockReturnValue(true);
      mockedUserModel.findById.mockResolvedValue(targetUser);

      const result = await adminSecurityService.forceGlobalLogout(targetUser, adminUser, twoFactorCode);

      expect(targetUser.sessionVersion).toBe(2); // Incremented from 1
      expect(targetUser.forcePasswordChangeOnNextLogin).toBe(true);
      expect(targetUser.save).toHaveBeenCalledTimes(1);
      expect(result.message).toBe('Todas as sessões do usuário foram revogadas.');
    });
  });
});
