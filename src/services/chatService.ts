// Lógica de negócio para buscar e exportar mensagens de chat.
import { IChatMessage, IRide, IUser } from "../types";
import { ChatMessageModel } from "../models/chat";

class ChatService {
  public async getChatHistory(
    rideId: IRide,
    senderId: IUser,
  ): Promise<IChatMessage[]> {
    return ChatMessageModel.find({
      $or: [{ ride: rideId }, { sender: senderId }],
    }).sort({ createdAt: 1 });
  }

  public async exportChatHistoryAsTxt(
    rideId: IRide,
    requestingUserId: IUser,
  ): Promise<string> {
    const messages = await this.getChatHistory(rideId, requestingUserId);
    if (messages.length === 0) return "Nenhuma mensagem nesta conversa.";

    const header = `Histórico de Chat - Carona ${rideId}\nExportado em: ${new Date().toISOString()}\n\n`;
    const body = messages
      .map(
        (msg) =>
          `[${new Date(msg.createdAt).toLocaleString("pt-BR", { timeZone: "UTC" })}] ${msg.sender.toString() === requestingUserId.toString() ? "Você" : "Outro"}: ${msg.content}`,
      )
      .join("\n");

    return header + body;
  }
}

export const chatService = new ChatService();
