import { Request, Response } from 'express';
import { adminSecurityController } from '../../../../src/controllers/admin/securityController';
import { adminSecurityService } from '../../../../src/services/admin/securityService';
import mongoose from 'mongoose';
import { IBlock, IUser } from '../../../../src/types';
import { UserRole } from '../../../../src/types/enums/enums';

// Mock dependencies
jest.mock('../../../../src/services/admin/securityService');

const mockedAdminSecurityService = adminSecurityService as jest.Mocked<typeof adminSecurityService>;

describe('AdminSecurityController', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: jest.Mock;
  let adminUser: IUser;
  let blockId: IBlock;
  let targetUserId: IUser;

  beforeEach(() => {
    jest.clearAllMocks();
    adminUser = { _id: new mongoose.Types.ObjectId(), roles: [UserRole.Admin] } as unknown as IUser;
    blockId = new mongoose.Types.ObjectId() as unknown as IBlock;
    targetUserId = new mongoose.Types.ObjectId() as unknown as IUser;
    req = { user: adminUser, params: {}, body: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  describe('viewBlocks', () => {
    it('should return a list of blocks on success', async () => {
      const mockBlocks = [{ _id: blockId, status: 'active' }];
      mockedAdminSecurityService.listAllBlocks.mockResolvedValue(mockBlocks as any);

      await adminSecurityController.viewBlocks(req as Request, res as Response);

      expect(mockedAdminSecurityService.listAllBlocks).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockBlocks);
    });

    it('should return 500 and error message on failure', async () => {
      const errorMessage = 'Service error';
      mockedAdminSecurityService.listAllBlocks.mockRejectedValue(new Error(errorMessage));

      await adminSecurityController.viewBlocks(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Erro ao visualizar bloqueios.', error: errorMessage });
    });
  });

  describe('viewBlockReason', () => {
    it('should return block details on success', async () => {
      const mockBlockDetails = { _id: blockId, reason: 'Spam' };
      mockedAdminSecurityService.getBlockDetails.mockResolvedValue(mockBlockDetails as any);
      req.params = { blockId: blockId.toString() };
      req.body = { twoFactorCode: '123456' };

      await adminSecurityController.viewBlockReason(req as Request, res as Response);

      expect(mockedAdminSecurityService.getBlockDetails).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockBlockDetails);
    });

    it('should return 500 and error message on failure', async () => {
      const errorMessage = 'Service error';
      mockedAdminSecurityService.getBlockDetails.mockRejectedValue(new Error(errorMessage));
      req.params = { blockId: blockId.toString() };
      req.body = { twoFactorCode: '123456' };

      await adminSecurityController.viewBlockReason(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Erro ao visualizar motivo do bloqueio.', error: errorMessage });
    });
  });

  describe('forceLogout', () => {
    it('should return success message on successful logout', async () => {
      mockedAdminSecurityService.forceGlobalLogout.mockResolvedValue({ message: 'Success' });
      req.params = { targetUserId: targetUserId.toString() };
      req.body = { twoFactorCode: '123456' };

      await adminSecurityController.forceLogout(req as Request, res as Response);

      expect(mockedAdminSecurityService.forceGlobalLogout).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Logout global forçado com sucesso. Todas as sessões do usuário foram revogadas.' });
    });

    it('should return 500 and error message on failure', async () => {
      const errorMessage = 'Service error';
      mockedAdminSecurityService.forceGlobalLogout.mockRejectedValue(new Error(errorMessage));
      req.params = { targetUserId: targetUserId.toString() };
      req.body = { twoFactorCode: '123456' };

      await adminSecurityController.forceLogout(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Erro ao forçar logout global.', error: errorMessage });
    });
  });
});
