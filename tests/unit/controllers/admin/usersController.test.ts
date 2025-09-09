
import { Request, Response } from 'express';
import { adminUsersController } from '../../../../src/controllers/admin/usersController';
import { adminUsersService } from '../../../../src/services/admin/userService';
import mongoose from 'mongoose';

// Mock dependencies
jest.mock('../../../src/services/admin/userService');

const mockedAdminUsersService = adminUsersService as jest.Mocked<typeof adminUsersService>;

describe('AdminUsersController', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: jest.Mock;
  let adminUser: any;
  let targetUserId: mongoose.Types.ObjectId;

  beforeEach(() => {
    jest.clearAllMocks();
    adminUser = { _id: new mongoose.Types.ObjectId(), roles: ['admin'] };
    targetUserId = new mongoose.Types.ObjectId();
    req = { user: adminUser, params: { targetUserId: targetUserId.toString() }, body: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  describe('listUsers', () => {
    it('should return a list of users on success', async () => {
      const mockUsers = [{ _id: targetUserId, name: 'Test User' }];
      mockedAdminUsersService.listUsers.mockResolvedValue(mockUsers as any);
      req.query = { status: 'approved' };

      await adminUsersController.listUsers(req as Request, res as Response);

      expect(mockedAdminUsersService.listUsers).toHaveBeenCalledWith(req.query);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockUsers);
    });

    it('should return 500 and error message on failure', async () => {
      const errorMessage = 'Service error';
      mockedAdminUsersService.listUsers.mockRejectedValue(new Error(errorMessage));

      await adminUsersController.listUsers(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Erro ao listar usuários.', error: errorMessage });
    });
  });

  describe('updateUserStatus', () => {
    it('should return updated user on success', async () => {
      const mockUpdatedUser = { _id: targetUserId, status: 'banned' };
      mockedAdminUsersService.updateUserStatus.mockResolvedValue(mockUpdatedUser as any);
      req.body = { status: 'banned', reason: 'Spam', twoFactorCode: '123456' };

      await adminUsersController.updateUserStatus(req as Request, res as Response);

      expect(mockedAdminUsersService.updateUserStatus).toHaveBeenCalledWith(
        targetUserId, adminUser, 'banned', 'Spam', '123456'
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockUpdatedUser);
    });

    it('should return 403 and error message on failure', async () => {
      const errorMessage = 'Permission denied';
      mockedAdminUsersService.updateUserStatus.mockRejectedValue(new Error(errorMessage));
      req.body = { status: 'banned', reason: 'Spam', twoFactorCode: '123456' };

      await adminUsersController.updateUserStatus(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: errorMessage });
    });
  });

  describe('updateUser', () => {
    it('should return updated user on success', async () => {
      const mockUpdatedUser = { _id: targetUserId, name: 'New Name' };
      mockedAdminUsersService.updateUser.mockResolvedValue(mockUpdatedUser as any);
      req.body = { name: 'New Name' };

      await adminUsersController.updateUser(req as Request, res as Response);

      expect(mockedAdminUsersService.updateUser).toHaveBeenCalledWith(
        targetUserId, adminUser, { name: 'New Name' }
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockUpdatedUser);
    });

    it('should return 403 and error message on failure', async () => {
      const errorMessage = 'Update failed';
      mockedAdminUsersService.updateUser.mockRejectedValue(new Error(errorMessage));
      req.body = { name: 'New Name' };

      await adminUsersController.updateUser(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: errorMessage });
    });
  });

  describe('promoteToAdmin', () => {
    it('should return success message and promoted user on success', async () => {
      const mockPromotedUser = { _id: targetUserId, roles: ['admin'] };
      mockedAdminUsersService.promoteToAdmin.mockResolvedValue(mockPromotedUser as any);
      req.body = { promoterTwoFactorCode: '123456' };

      await adminUsersController.promoteToAdmin(req as Request, res as Response);

      expect(mockedAdminUsersService.promoteToAdmin).toHaveBeenCalledWith(
        targetUserId, adminUser, '123456'
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Usuário promovido a administrador com sucesso.', user: mockPromotedUser });
    });

    it('should return 403 and error message on failure', async () => {
      const errorMessage = 'Promotion failed';
      mockedAdminUsersService.promoteToAdmin.mockRejectedValue(new Error(errorMessage));
      req.body = { promoterTwoFactorCode: '123456' };

      await adminUsersController.promoteToAdmin(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: errorMessage });
    });
  });

  describe('updateAdminPermissions', () => {
    it('should return updated user on success', async () => {
      const mockUpdatedUser = { _id: targetUserId, permissions: ['new:perm'] };
      mockedAdminUsersService.updateAdminPermissions.mockResolvedValue(mockUpdatedUser as any);
      req.body = { permissions: ['new:perm'] };

      await adminUsersController.updateAdminPermissions(req as Request, res as Response);

      expect(mockedAdminUsersService.updateAdminPermissions).toHaveBeenCalledWith(
        targetUserId, adminUser, ['new:perm']
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockUpdatedUser);
    });

    it('should return 403 and error message on failure', async () => {
      const errorMessage = 'Permission update failed';
      mockedAdminUsersService.updateAdminPermissions.mockRejectedValue(new Error(errorMessage));
      req.body = { permissions: ['new:perm'] };

      await adminUsersController.updateAdminPermissions(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: errorMessage });
    });
  });

  describe('getAdminPermissions', () => {
    it('should return admin permissions on success', async () => {
      const mockPermissions = { permissions: ['admin:all'] };
      mockedAdminUsersService.getAdminPermissions.mockResolvedValue(mockPermissions as any);

      await adminUsersController.getAdminPermissions(req as Request, res as Response);

      expect(mockedAdminUsersService.getAdminPermissions).toHaveBeenCalledWith(targetUserId);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockPermissions);
    });

    it('should return 404 and error message on failure', async () => {
      const errorMessage = 'User not found';
      mockedAdminUsersService.getAdminPermissions.mockRejectedValue(new Error(errorMessage));

      await adminUsersController.getAdminPermissions(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: errorMessage });
    });
  });

  describe('demoteAdmin', () => {
    it('should return success message and demoted user on success', async () => {
      const mockDemotedUser = { _id: targetUserId, roles: ['user'] };
      mockedAdminUsersService.demoteAdmin.mockResolvedValue(mockDemotedUser as any);
      req.body = { reason: 'No longer needed', twoFactorCode: '123456' };

      await adminUsersController.demoteAdmin(req as Request, res as Response);

      expect(mockedAdminUsersService.demoteAdmin).toHaveBeenCalledWith(
        targetUserId, adminUser, 'No longer needed', '123456'
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Administrador rebaixado com sucesso.', user: mockDemotedUser });
    });

    it('should return 403 and error message on failure', async () => {
      const errorMessage = 'Demotion failed';
      mockedAdminUsersService.demoteAdmin.mockRejectedValue(new Error(errorMessage));
      req.body = { reason: 'No longer needed', twoFactorCode: '123456' };

      await adminUsersController.demoteAdmin(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: errorMessage });
    });
  });
});
