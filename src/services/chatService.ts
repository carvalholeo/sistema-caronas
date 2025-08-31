// Lógica de negócio para buscar e exportar mensagens de chat.
import { ChatMessageModel, IChatMessage } from '../models/chat';
import { RideModel } from '../models/ride';
import { PassengerStatus } from 'types';
import { Types } from 'mongoose';

class ChatService {
  public async getChatHistory(rideId: Types.ObjectId, senderId: Types.ObjectId): Promise<IChatMessage[]> {
    return ChatMessageModel.find({
      $or: [
        { ride: rideId },
        { sender: senderId }
      ]
    }).sort({ createdAt: 1 });
  }

  public async exportChatHistoryAsTxt(rideId: Types.ObjectId, requestingUserId: Types.ObjectId): Promise<string> {
    const messages = await this.getChatHistory(rideId, requestingUserId);
    if (messages.length === 0) return "Nenhuma mensagem nesta conversa.";

    const header = `Histórico de Chat - Carona ${rideId}\nExportado em: ${new Date().toISOString()}\n\n`;
    const body = messages.map(msg =>
      `[${new Date(msg.createdAt).toLocaleString()}] ${msg.sender.toString() === requestingUserId.toString() ? 'Você' : 'Outro'}: ${msg.content}`
    ).join('\n');

    return header + body;
  }
}

export const chatService = new ChatService();
