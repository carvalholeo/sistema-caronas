import { Request, Response } from 'express';
import { adminUsersService } from 'services/admin/userService';
import { Types } from 'mongoose';
import { IUser } from 'types';

class AdminUsersController {
  /**
   * Lista usuários com base em filtros de query.
   */
  public async listUsers(req: Request, res: Response): Promise<Response> {
    try {
      const users = await adminUsersService.listUsers(req.query);
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
      const { targetUserId } = req.params;
      const { status, reason, twoFactorCode } = req.body;
      const adminUser = req.user!;

      const updatedUser = await adminUsersService.updateUserStatus(
        targetUserId as unknown as Types.ObjectId,
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
      const { targetUserId } = req.params;
      const adminUser = req.user!;

      const updatedUser = await adminUsersService.updateUser(targetUserId as unknown as Types.ObjectId, adminUser, req.body);
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
      const { targetUserId } = req.params;
      const { promoterTwoFactorCode } = req.body;
      const adminUser = req.user!;

      const promotedUser = await adminUsersService.promoteToAdmin(
        targetUserId as unknown as Types.ObjectId,
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
      const { targetUserId } = req.params;
      const { permissions } = req.body;
      const adminUser = req.user!;

      const updatedUser = await adminUsersService.updateAdminPermissions(
        targetUserId as unknown as Types.ObjectId,
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
      const { targetUserId } = req.params;
      const permissions = await adminUsersService.getAdminPermissions(targetUserId as unknown as Types.ObjectId);
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
      const { targetUserId } = req.params;
      const { reason, twoFactorCode } = req.body;
      const adminUser = req.user!;

      const demotedUser = await adminUsersService.demoteAdmin(
        targetUserId as unknown as Types.ObjectId,
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

