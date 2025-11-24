import { Request, Response } from 'express';
import { adminUsersService } from '../../services/admin/userService';
import { IUser } from '../../types';
import { IAdminListUsersQuery } from '@/types/requests/admin/users';

class AdminUsersController {
  /**
   * Lista usuários com base em filtros de query.
   */
  public async listUsers(req: Request, res: Response): Promise<Response> {
    try {
      const query: IAdminListUsersQuery = req.query;
      const users = await adminUsersService.listUsers(query);
      return res.status(200).json(users);
    } catch (error: Error | any) {
      return res.status(500).json({ message: 'Erro ao listar usuários.', error: error.message });
    }
  }

  /**
   * Atualiza o status de um usuário (aprovar, suspender, banir, etc.).
   */
  public async updateUserStatus(req: Request, res: Response): Promise<Response> {
    try {
      const targetUserId: IUser = req.params.targetUserId as unknown as IUser;
      const { status, reason, twoFactorCode } = req.body;
      const adminUser = req.user!;

      const updatedUser = await adminUsersService.updateUserStatus(
        targetUserId,
        adminUser,
        status,
        reason,
        twoFactorCode
      );
      return res.status(200).json(updatedUser);
    } catch (error: Error | any) {
      return res.status(403).json({ message: error.message });
    }
  }

  /**
   * Edita os dados de um usuário, força a troca de senha ou desativa o 2FA.
   */
  public async updateUser(req: Request, res: Response): Promise<Response> {
    try {
      const targetUserId: IUser = req.params.targetUserId as unknown as IUser;
      const adminUser = req.user!;

      const updatedUser = await adminUsersService.updateUser(targetUserId, adminUser, req.body);
      return res.status(200).json(updatedUser);
    } catch (error: Error | any) {
      return res.status(403).json({ message: error.message });
    }
  }

  /**
   * Promove um usuário comum a administrador.
   */
  public async promoteToAdmin(req: Request, res: Response): Promise<Response> {
    try {
      const targetUserId: IUser = req.params.targetUserId as unknown as IUser;
      const { promoterTwoFactorCode } = req.body;
      const adminUser = req.user!;

      const promotedUser = await adminUsersService.promoteToAdmin(
        targetUserId,
        adminUser,
        promoterTwoFactorCode
      );
      return res.status(200).json({ message: 'Usuário promovido a administrador com sucesso.', user: promotedUser });
    } catch (error: Error | any) {
      return res.status(403).json({ message: error.message });
    }
  }

  /**
   * Atualiza as permissões de um administrador.
   */
  public async updateAdminPermissions(req: Request, res: Response): Promise<Response> {
    try {
      const targetUserId: IUser = req.params.targetUserId as unknown as IUser;
      const { permissions } = req.body;
      const adminUser = req.user!;

      const updatedUser = await adminUsersService.updateAdminPermissions(
        targetUserId,
        adminUser as unknown as IUser,
        permissions
      );
      return res.status(200).json(updatedUser);
    } catch (error: Error | any) {
      return res.status(403).json({ message: error.message });
    }
  }

  /**
   * Obtém as permissões de um administrador específico.
   */
  public async getAdminPermissions(req: Request, res: Response): Promise<Response> {
    try {
      const targetUserId: IUser = req.params.targetUserId as unknown as IUser;
      const permissions = await adminUsersService.getAdminPermissions(targetUserId);
      return res.status(200).json(permissions);
    } catch (error: Error | any) {
      return res.status(404).json({ message: error.message });
    }
  }

  /**
   * Rebaixa um administrador para usuário comum.
   */
  public async demoteAdmin(req: Request, res: Response): Promise<Response> {
    try {
      const targetUserId: IUser = req.params.targetUserId as unknown as IUser;
      const { reason, twoFactorCode } = req.body;
      const adminUser = req.user!;

      const demotedUser = await adminUsersService.demoteAdmin(
        targetUserId,
        adminUser,
        reason,
        twoFactorCode
      );
      return res.status(200).json({ message: 'Administrador rebaixado com sucesso.', user: demotedUser });
    } catch (error: Error | any) {
      return res.status(403).json({ message: error.message });
    }
  }
}

export const adminUsersController = new AdminUsersController();

