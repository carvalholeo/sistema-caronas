
import { adminChatService } from '../../../../src/services/admin/chatService';
import { ChatMessageModel } from '../../../../src/models/chat';
import { AuditLogModel } from '../../../../src/models/auditLog';
import { authService } from '../../../../src/services/authService';
import mongoose from 'mongoose';
import { AuditActionType, AuditLogSeverityLevels } from '../../../../src/types/enums/enums';

// Mock dependencies
jest.mock('../../../src/models/chat');
jest.mock('../../../src/models/auditLog');
jest.mock('../../../src/services/authService');

const mockedChatMessageModel = ChatMessageModel as jest.Mocked<typeof ChatMessageModel>;
const mockedAuditLogModel = AuditLogModel as jest.Mocked<typeof AuditLogModel>;
const mockedAuthService = authService as jest.Mocked<typeof authService>;

describe('AdminChatService', () => {
  let adminUser: any;
  let senderUser: any;
  let rideId: mongoose.Types.ObjectId;

  beforeEach(() => {
    jest.clearAllMocks();
    adminUser = { _id: new mongoose.Types.ObjectId(), twoFactorSecret: 'secret', roles: ['admin'] };
    senderUser = { _id: new mongoose.Types.ObjectId(), name: 'Sender User', matricula: 'SENDER123' };
    rideId = new mongoose.Types.ObjectId();

    // Mock AuditLogModel constructor and save method
    (mockedAuditLogModel as jest.Mock).mockImplementation(() => ({
      save: jest.fn().mockResolvedValue(undefined),
    }));
  });

  describe('readConversation', () => {
    it('should return chat messages and log the audit entry', async () => {
      const mockMessages = [
        { _id: new mongoose.Types.ObjectId(), sender: senderUser, content: 'Hello', createdAt: new Date(), populate: jest.fn().mockReturnThis() },
        { _id: new mongoose.Types.ObjectId(), sender: senderUser, content: 'Hi', createdAt: new Date(), populate: jest.fn().mockReturnThis() },
      ];
      mockedChatMessageModel.find.mockReturnValue({ populate: jest.fn().mockResolvedValue(mockMessages) } as any);

      const result = await adminChatService.readConversation(rideId, senderUser._id, adminUser);

      expect(mockedAuditLogModel).toHaveBeenCalledTimes(1);
      const auditLogCall = (mockedAuditLogModel as jest.Mock).mock.calls[0][0];
      expect(auditLogCall.action.actionType).toBe(AuditActionType.CHAT_HISTORY_VIEWED_BY_ADMIN);
      expect(auditLogCall.actor.userId).toEqual(adminUser._id);
      expect(auditLogCall.target.resourceId).toEqual(rideId);
      expect(auditLogCall.metadata.extra.targetUser.resourceId).toEqual(senderUser._id);
      expect(auditLogCall.metadata.severity).toBe(AuditLogSeverityLevels.CRITICAL);

      expect(mockedChatMessageModel.find).toHaveBeenCalledWith({
        $or: [
          { sender: senderUser._id },
          { ride: rideId },
        ],
      });
      expect(result).toEqual(mockMessages);
    });
  });

  describe('moderateMessage', () => {
    const messageId = new mongoose.Types.ObjectId();
    const reason = 'Inappropriate content';

    it('should moderate a message and log the audit entry', async () => {
      const mockMessage = {
        _id: messageId,
        content: 'Original content',
        isModerated: false,
        moderationDetails: undefined,
        save: jest.fn().mockResolvedValue(undefined),
      };
      mockedChatMessageModel.findById.mockResolvedValue(mockMessage as any);

      const result = await adminChatService.moderateMessage(messageId, adminUser, reason);

      expect(mockMessage.isModerated).toBe(true);
      expect(mockMessage.content).toBe('[Mensagem removida pela moderação]');
      expect(mockMessage.moderationDetails).toBeDefined();
      expect(mockMessage.moderationDetails.reason).toBe(reason);
      expect(mockMessage.save).toHaveBeenCalledTimes(1);

      expect(mockedAuditLogModel).toHaveBeenCalledTimes(1);
      const auditLogCall = (mockedAuditLogModel as jest.Mock).mock.calls[0][0];
      expect(auditLogCall.action.actionType).toBe(AuditActionType.CHAT_MESSAGE_MODERATED_BY_ADMIN);
      expect(auditLogCall.action.detail).toBe(reason);
      expect(auditLogCall.target.resourceId).toEqual(messageId);
      expect(result).toBe(mockMessage);
    });

    it('should throw an error if message is not found', async () => {
      mockedChatMessageModel.findById.mockResolvedValue(null);
      await expect(adminChatService.moderateMessage(messageId, adminUser, reason)).rejects.toThrow('Mensagem não encontrada.');
    });
  });

  describe('exportConversation', () => {
    const twoFactorCode = '123456';

    it('should export conversation and log audit entry if 2FA is valid', async () => {
      mockedAuthService.verifyTwoFactorCode.mockReturnValue(true);
      const mockMessages = [
        { createdAt: new Date('2023-01-01T10:00:00Z'), sender: { name: 'User1' }, content: 'Msg1' },
        { createdAt: new Date('2023-01-01T10:01:00Z'), sender: { name: 'User2' }, content: 'Msg2' },
      ];
      // Mock readConversation indirectly by mocking ChatMessageModel.find
      mockedChatMessageModel.find.mockReturnValue({ populate: jest.fn().mockResolvedValue(mockMessages) } as any);

      const result = await adminChatService.exportConversation(rideId, senderUser, adminUser, twoFactorCode);

      expect(mockedAuthService.verifyTwoFactorCode).toHaveBeenCalledWith(adminUser.twoFactorSecret, twoFactorCode);
      expect(mockedAuditLogModel).toHaveBeenCalledTimes(1);
      const auditLogCall = (mockedAuditLogModel as jest.Mock).mock.calls[0][0];
      expect(auditLogCall.action.actionType).toBe(AuditActionType.CHAT_LOGS_EXPORTED_BY_ADMIN);
      expect(auditLogCall.actor.userId).toEqual(adminUser._id);
      expect(auditLogCall.target.resourceId).toEqual(rideId);
      expect(auditLogCall.metadata.extra.targetUser.resourceId).toEqual(senderUser._id);

      expect(result).toContain('Msg1');
      expect(result).toContain('Msg2');
    });

    it('should throw an error if 2FA code is invalid', async () => {
      mockedAuthService.verifyTwoFactorCode.mockReturnValue(false);
      await expect(adminChatService.exportConversation(rideId, senderUser, adminUser, twoFactorCode)).rejects.toThrow('Código 2FA inválido.');
    });
  });
});
