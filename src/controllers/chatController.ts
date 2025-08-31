import { Request, Response } from 'express';
import { chatService } from '../services/chatService';
import { Types } from 'mongoose';

class ChatController {
  public async getHistory(req: Request, res: Response): Promise<Response> {
    try {
      const { rideId } = req.params;
      const history = await chatService.getChatHistory(rideId as unknown as Types.ObjectId, req.user!._id);
      return res.status(200).json(history);
    } catch (error: any) {
      return res.status(500).json({ message: 'Erro ao buscar histórico.', error: error.message });
    }
  }

  public async exportHistory(req: Request, res: Response): Promise<void> {
    try {
      const { rideId } = req.params;
      const txtContent = await chatService.exportChatHistoryAsTxt(rideId as unknown as Types.ObjectId, req.user!._id);
      res.setHeader('Content-disposition', `attachment; filename=chat_${rideId}.txt`);
      res.setHeader('Content-type', 'text/plain');
      res.charset = 'UTF-8';
      res.write(txtContent);
      res.end();
    } catch (error: any) {
      res.status(500).json({ message: 'Erro ao exportar histórico.', error: error.message });
    }
  }
}

export const chatController = new ChatController();

