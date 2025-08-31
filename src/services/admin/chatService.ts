// Lógica de negócio para moderação e auditoria de chats.
import { ChatMessageModel, IChatMessage } from '../../models/chat';
import { AuditLogModel } from '../../models/auditLog';
import { authService } from '../authService';
import { IUser, UserModel } from '../../models/user';
import { Types } from 'mongoose';
import { User } from 'types';

class AdminChatService {
  public async readConversation(rideId: Types.ObjectId, senderId: Types.ObjectId, adminId: IUser): Promise<IChatMessage[]> {
    await new AuditLogModel({
      adminUser: adminId,
      action: 'chat:ler',
      target: { type: 'chat', id: `${rideId}` },
      details: { message: "Admin leu a conversa." }
    }).save();

    return ChatMessageModel.find({
      $or: [
        { sender: senderId },
        { ride: rideId, }
      ]
    }).populate('sender receiver', 'name matricula');
  }

  public async moderateMessage(messageId: Types.ObjectId, adminId: IUser, reason: string): Promise<IChatMessage | null> {
    const message = await ChatMessageModel.findById(messageId);
    if (!message) throw new Error("Mensagem não encontrada.");

    message.isModerated = true;
    message.moderationDetails = {
      originalContent: message.content,
      moderatedBy: adminId as any,
      moderatedAt: new Date(),
      reason: reason,
    };
    message.content = "[Mensagem removida pela moderação]";

    await message.save();
    return message;
  }

  public async exportConversation(rideId: Types.ObjectId, senderId: IUser, adminUser: IUser, twoFactorCode: string): Promise<string> {
    if (!authService.verifyTwoFactorCode(adminUser.twoFactorSecret, twoFactorCode)) {
      throw new Error("Código 2FA inválido.");
    }
    await new AuditLogModel({
      adminUser: adminUser._id,
      action: 'chat:exportar_logs',
      target: { type: 'chat', id: `${rideId}/${senderId}` },
      details: { message: "Admin exportou a conversa." }
    }).save();

    const messages = await this.readConversation(rideId, senderId.id, adminUser);
    return messages.map(msg => `[${msg.createdAt}] ${msg.sender.name}: ${msg.content}`).join('\n');
  }
}

export const adminChatService = new AdminChatService();
