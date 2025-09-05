import { Request, Response } from 'express';
import { adminPrivacyService } from '../../services/admin/privacyService';
import { Types } from 'mongoose';

class AdminPrivacyController {
  /**
   * Gera um relatório de dados completo para um usuário específico.
   * Requer a permissão 'privacidade:emitir_relatorio' e 2FA do administrador.
   */
  public async generateDataReport(req: Request, res: Response): Promise<Response> {
    try {
      const { targetUserId } = req.params;
      const { twoFactorCode } = req.body;
      const adminUser = req.user!;
      const report = await adminPrivacyService.generateDataReport(
        targetUserId as unknown as Types.ObjectId,
        adminUser,
        twoFactorCode
      );
      return res.status(200).json(report);
    } catch (error: Error | any) {
      return res.status(500).json({ message: 'Erro ao gerar relatório de dados.', error: error.message });
    }
  }

  /**
   * Processa uma solicitação de remoção de usuário (soft delete).
   * Requer a permissão 'privacidade:solicitacao_remocao' e 2FA do administrador.
   */
  public async processRemovalRequest(req: Request, res: Response): Promise<Response> {
    try {
      const { targetUserId } = req.params;
      const { twoFactorCode } = req.body;
      const adminUser = req.user!;
      await adminPrivacyService.processUserRemoval(
        targetUserId as unknown as Types.ObjectId,
        adminUser,
        twoFactorCode
      );
      return res.status(200).json({ message: 'Solicitação de remoção processada com sucesso. O usuário foi anonimizado.' });
    } catch (error: Error | any) {
      return res.status(500).json({ message: 'Erro ao processar solicitação de remoção.', error: error.message });
    }
  }

  /**
   * Visualiza logs de auditoria específicos de privacidade.
   * Requer a permissão 'privacidade:ver_logs'.
   */
  public async viewPrivacyLogs(req: Request, res: Response): Promise<Response> {
    try {
      const { targetUserId } = req.params;
      const logs = await adminPrivacyService.viewPrivacyLogs(
        targetUserId as unknown as Types.ObjectId,
        req.user!
      );
      return res.status(200).json(logs);
    } catch (error: Error | any) {
      return res.status(500).json({ message: 'Erro ao visualizar logs de privacidade.', error: error.message });
    }
  }

  /**
   * Envia uma notificação formal para um usuário sobre uma questão de privacidade.
   * Requer a permissão 'privacidade:notificar_usuario'.
   */
  public async sendFormalNotification(req: Request, res: Response): Promise<Response> {
    try {
      const { targetUserId } = req.params;
      const { subject, body } = req.body;
      const adminUser = req.user!;
      await adminPrivacyService.sendFormalNotification(
        targetUserId as unknown as Types.ObjectId,
        adminUser,
        subject,
        body
      );
      return res.status(200).json({ message: 'Notificação formal enviada com sucesso.' });
    } catch (error: Error | any) {
      return res.status(500).json({ message: 'Erro ao enviar notificação formal.', error: error.message });
    }
  }
}

export const adminPrivacyController = new AdminPrivacyController();

