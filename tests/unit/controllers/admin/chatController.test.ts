
import { Request, Response } from 'express';
import { adminChatController } from '../../../../src/controllers/admin/chatController';
import { adminChatService } from '../../../../src/services/admin/chatService';
import mongoose from 'mongoose';

// Mock dependencies
jest.mock('../../../src/services/admin/chatService');

const mockedAdminChatService = adminChatService as jest.Mocked<typeof adminChatService>;

describe('AdminChatController', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: jest.Mock;
  let adminUser: any;

  beforeEach(() => {
    jest.clearAllMocks();
    adminUser = { _id: new mongoose.Types.ObjectId(), roles: ['admin'] };
    req = { user: adminUser, params: {}, body: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
      headersSent: false,
    };
    next = jest.fn();
  });

  describe('getChatHistoryForAdmin', () => {
    it('should return chat messages on success', async () => {
      const mockMessages = [{ content: 'Hello' }];
      mockedAdminChatService.readConversation.mockResolvedValue(mockMessages as any);
      req.params = { rideId: 'ride123', senderId: 'user123' };

      await adminChatController.getChatHistoryForAdmin(req as Request, res as Response);

      expect(mockedAdminChatService.readConversation).toHaveBeenCalledWith(
        'ride123', 'user123', adminUser
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockMessages);
    });

    it('should return 500 and error message on failure', async () => {
      const errorMessage = 'Service error';
      mockedAdminChatService.readConversation.mockRejectedValue(new Error(errorMessage));
      req.params = { rideId: 'ride123', senderId: 'user123' };

      await adminChatController.getChatHistoryForAdmin(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Erro ao obter histórico do chat para auditoria.', error: errorMessage });
    });
  });

  describe('moderateMessage', () => {
    it('should return moderated message on success', async () => {
      const mockModeratedMessage = { content: '[Mensagem removida]' };
      mockedAdminChatService.moderateMessage.mockResolvedValue(mockModeratedMessage as any);
      req.params = { messageId: 'msg123' };
      req.body = { reason: 'Spam' };

      await adminChatController.moderateMessage(req as Request, res as Response);

      expect(mockedAdminChatService.moderateMessage).toHaveBeenCalledWith(
        'msg123', adminUser, 'Spam'
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockModeratedMessage);
    });

    it('should return 403 and error message on failure', async () => {
      const errorMessage = 'Message not found';
      mockedAdminChatService.moderateMessage.mockRejectedValue(new Error(errorMessage));
      req.params = { messageId: 'msg123' };
      req.body = { reason: 'Spam' };

      await adminChatController.moderateMessage(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: errorMessage });
    });
  });

  describe('exportChatLogs', () => {
    it('should export chat logs and set headers on success', async () => {
      const mockContent = 'Chat log content';
      mockedAdminChatService.exportConversation.mockResolvedValue(mockContent);
      req.params = { rideId: 'ride123', senderId: 'user123' };
      req.body = { twoFactorCode: '123456' };

      await adminChatController.exportChatLogs(req as Request, res as Response);

      expect(mockedAdminChatService.exportConversation).toHaveBeenCalledWith(
        'ride123', 'user123', adminUser, '123456'
      );
      expect(res.setHeader).toHaveBeenCalledWith('Content-disposition', 'attachment; filename=ride123_chat_logs.txt');
      expect(res.setHeader).toHaveBeenCalledWith('Content-type', 'text/plain; charset=utf-8');
      expect(res.write).toHaveBeenCalledWith(mockContent);
      expect(res.end).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled(); // Should not send status if headers are sent
    });

    it('should return 500 and error message on failure if headers not sent', async () => {
      const errorMessage = 'Export error';
      mockedAdminChatService.exportConversation.mockRejectedValue(new Error(errorMessage));
      req.params = { rideId: 'ride123', senderId: 'user123' };
      req.body = { twoFactorCode: '123456' };

      await adminChatController.exportChatLogs(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Erro ao exportar logs do chat.', error: errorMessage });
    });

    it('should not send error response if headers already sent', async () => {
      const errorMessage = 'Export error';
      mockedAdminChatService.exportConversation.mockRejectedValue(new Error(errorMessage));
      req.params = { rideId: 'ride123', senderId: 'user123' };
      req.body = { twoFactorCode: '123456' };
      res.headersSent = true; // Simulate headers already sent

      await adminChatController.exportChatLogs(req as Request, res as Response);

      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });
});
