// Lógica de negócio para moderação e auditoria de chats.
import { ChatMessageModel } from 'models/chat';
import { AuditLogModel } from 'models/auditLog';
import { authService } from 'services/authService';
import { Types } from 'mongoose';
import { IChatMessage, IUser } from 'types';
import { AuditActionType, AuditLogCategory, AuditLogSeverityLevels } from 'types/enums/enums';

class AdminChatService {
  public async readConversation(rideId: Types.ObjectId, senderId: Types.ObjectId, adminId: IUser): Promise<IChatMessage[]> {
    const auditEntry = new AuditLogModel({
      actor: {
        userId: adminId._id,
        isAdmin: true,
        ip: '::1',
      },
      action: {
        actionType: AuditActionType.CHAT_HISTORY_VIEWED_BY_ADMIN,
        category: AuditLogCategory.CHAT
      },
      target: {
        resourceType: ChatMessageModel.baseModelName,
        resourceId: rideId
      },
      metadata: {
        severity: AuditLogSeverityLevels.CRITICAL,
        extra: {
          targetUser: {
            resourceType: 'user',
            resourceId: senderId._id
          }
        }
      }
    });
    await auditEntry.save();


    return ChatMessageModel.find({
      $or: [
        { sender: senderId },
        { ride: rideId, }
      ]
    }).populate('sender', 'name matricula');
  }

  public async moderateMessage(messageId: Types.ObjectId, adminId: IUser, reason: string): Promise<IChatMessage | null> {
    const message = await ChatMessageModel.findById(messageId);
    if (!message) throw new Error("Mensagem não encontrada.");

    message.isModerated = true;
    message.moderationDetails = {
      originalContent: message.content,
      moderatedBy: adminId._id,
      moderatedAt: new Date(),
      reason: reason,
    };
    message.content = "[Mensagem removida pela moderação]";

    await message.save();

    const auditEntry = new AuditLogModel({
      actor: {
        userId: adminId._id,
        isAdmin: true,
        ip: '::1',
      },
      action: {
        actionType: AuditActionType.CHAT_MESSAGE_MODERATED_BY_ADMIN,
        category: AuditLogCategory.CHAT,
        detail: reason
      },
      target: {
        resourceType: ChatMessageModel.baseModelName,
        resourceId: messageId
      },
      metadata: {
        severity: AuditLogSeverityLevels.CRITICAL
      }
    });
    await auditEntry.save();

    return message;
  }

  public async exportConversation(rideId: Types.ObjectId, senderId: IUser, adminUser: IUser, twoFactorCode: string): Promise<string> {
    if (!authService.verifyTwoFactorCode(adminUser.twoFactorSecret, twoFactorCode)) {
      throw new Error("Código 2FA inválido.");
    }

    const auditEntry = new AuditLogModel({
      actor: {
        userId: adminUser._id,
        isAdmin: true,
        ip: '::1',
      },
      action: {
        actionType: AuditActionType.CHAT_LOGS_EXPORTED_BY_ADMIN,
        category: AuditLogCategory.CHAT
      },
      target: {
        resourceType: ChatMessageModel.baseModelName,
        resourceId: rideId
      },
      metadata: {
        severity: AuditLogSeverityLevels.WARN,
        extra: {
          targetUser: {
            resourceType: 'user',
            resourceId: senderId._id
          }
        }
      }
    });
    await auditEntry.save();

    const messages = await this.readConversation(rideId, senderId.id, adminUser);
    return messages.map(msg => `[${msg.createdAt}] ${msg.sender.name}: ${msg.content}`).join('\n');
  }
}

export const adminChatService = new AdminChatService();
