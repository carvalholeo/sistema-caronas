import { Request, Response } from 'express';
import { adminSecurityService } from 'services/admin/securityService';
import { Types } from 'mongoose';
import { IBlock, IUser } from 'types';

class AdminSecurityController {
  /**
   * Visualiza a lista de bloqueios entre usuários.
   * Requer a permissão 'seguranca:ver_bloqueios'.
   */
  public async viewBlocks(req: Request, res: Response): Promise<Response> {
    try {
      const blocks = await adminSecurityService.listAllBlocks();
      return res.status(200).json(blocks);
    } catch (error: Error | any) {
      return res.status(500).json({ message: 'Erro ao visualizar bloqueios.', error: error.message });
    }
  }

  /**
   * Visualiza o motivo detalhado de um bloqueio específico.
   * Requer a permissão 'seguranca:ver_motivos' e 2FA do administrador.
   */
  public async viewBlockReason(req: Request, res: Response): Promise<Response> {
    try {
      const blockId: IBlock = req.params.blockId as unknown as IBlock;
      const { twoFactorCode } = req.body;
      const adminUser = req.user!;
      const block = await adminSecurityService.getBlockDetails(
        blockId,
        adminUser,
        twoFactorCode
      );
      return res.status(200).json(block);
    } catch (error: Error | any) {
      return res.status(500).json({ message: 'Erro ao visualizar motivo do bloqueio.', error: error.message });
    }
  }

  /**
   * Força o logout global de um usuário.
   * Requer a permissão 'seguranca:forcar_logout' e 2FA do administrador.
   */
  public async forceLogout(req: Request, res: Response): Promise<Response> {
    try {
      const targetUserId: IUser = req.params.targetUserId as unknown as IUser;
      const { twoFactorCode } = req.body;
      const adminUser = req.user!;
      await adminSecurityService.forceGlobalLogout(
        targetUserId,
        adminUser,
        twoFactorCode
      );
      return res.status(200).json({ message: 'Logout global forçado com sucesso. Todas as sessões do usuário foram revogadas.' });
    } catch (error: Error | any) {
      return res.status(500).json({ message: 'Erro ao forçar logout global.', error: error.message });
    }
  }
}

export const adminSecurityController = new AdminSecurityController();
