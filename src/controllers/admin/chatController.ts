import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { adminChatService } from '../../services/admin/chatService';
import { Types } from 'mongoose';
import { IUser } from 'types';

class AdminChatController {
  /**
   * Obtém o histórico de uma conversa específica para fins de auditoria.
   * Requer a permissão 'chat:ler'.
   */
  public async getChatHistoryForAdmin(req: Request, res: Response): Promise<Response> {
    try {
      const { rideId, senderId } = req.params;
      const adminUser = req.user!;
      const messages = await adminChatService.readConversation(
        rideId as unknown as Types.ObjectId,
        senderId as unknown as Types.ObjectId,
        adminUser);
      return res.status(200).json(messages);
    } catch (error: Error | any) {
      return res.status(500).json({ message: 'Erro ao obter histórico do chat para auditoria.', error: error.message });
    }
  }

  /**
   * Modera uma mensagem, ocultando seu conteúdo original.
   * Requer a permissão 'chat:moderar'.
   */
  public async moderateMessage(req: Request, res: Response): Promise<Response> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { messageId } = req.params;
      const { reason } = req.body;
      const adminUser = req.user!;
      const moderatedMessage = await adminChatService.moderateMessage(
        messageId as unknown as Types.ObjectId,
        adminUser,
        reason
      );
      return res.status(200).json(moderatedMessage);
    } catch (error: Error | any) {
      return res.status(403).json({ message: error.message });
    }
  }

  /**
   * Exporta os logs de uma conversa para um arquivo de texto.
   * Requer a permissão 'chat:exportar_logs' e 2FA do administrador.
   */
  public async exportChatLogs(req: Request, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    try {
      const { rideId, senderId } = req.params;
      const { twoFactorCode } = req.body;
      const adminUser = req.user!;

      const content = await adminChatService.exportConversation(
        rideId as unknown as Types.ObjectId,
        senderId as unknown as IUser,
        adminUser,
        twoFactorCode
      );

      res.setHeader('Content-disposition', `attachment; filename=${rideId}_chat_logs.txt`);
      res.setHeader('Content-type', 'text/plain; charset=utf-8');
      res.write(content);
      res.end();
    } catch (error: Error | any) {
      // Evita o envio de outro status se os headers já foram enviados
      if (!res.headersSent) {
        res.status(500).json({ message: 'Erro ao exportar logs do chat.', error: error.message });
      }
    }
  }
}

export const adminChatController = new AdminChatController();

