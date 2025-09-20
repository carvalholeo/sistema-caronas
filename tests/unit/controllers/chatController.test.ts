import { Request, Response } from 'express';
import { chatController } from '../../../src/controllers/chatController';
import { chatService } from '../../../src/services/chatService';
import mongoose from 'mongoose';
import { IRide, IUser } from '../../../src/types';

// Mock dependencies
jest.mock('../../../src/services/chatService');

const mockedChatService = chatService as jest.Mocked<typeof chatService>;

describe('ChatController', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: jest.Mock;
  let userId: IUser;
  let rideId: IRide

  beforeEach(() => {
    jest.clearAllMocks();
    userId = new mongoose.Types.ObjectId() as unknown as IUser;
    rideId = new mongoose.Types.ObjectId() as unknown as IRide;
    req = { user:  userId, params: { rideId: rideId.toString() } };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
      charset: '',
    };
    next = jest.fn();
  });

  describe('getHistory', () => {
    it('should return chat history on success', async () => {
      const mockHistory = [{ content: 'Hello' }];
      mockedChatService.getChatHistory.mockResolvedValue(mockHistory as any);

      await chatController.getHistory(req as Request, res as Response);

      expect(mockedChatService.getChatHistory).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockHistory);
    });

    it('should return 500 and error message on failure', async () => {
      const errorMessage = 'Service error';
      mockedChatService.getChatHistory.mockRejectedValue(new Error(errorMessage));

      await chatController.getHistory(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Erro ao buscar histórico.', error: errorMessage });
    });
  });

  describe('exportHistory', () => {
    it('should export chat history and set headers on success', async () => {
      const mockContent = 'Chat history content';
      mockedChatService.exportChatHistoryAsTxt.mockResolvedValue(mockContent);

      await chatController.exportHistory(req as Request, res as Response);

      expect(mockedChatService.exportChatHistoryAsTxt).toHaveBeenCalled();
      expect(res.setHeader).toHaveBeenCalledWith('Content-disposition', `attachment; filename=chat_${rideId}.txt`);
      expect(res.setHeader).toHaveBeenCalledWith('Content-type', 'text/plain');
      expect(res.charset).toBe('UTF-8');
      expect(res.write).toHaveBeenCalledWith(mockContent);
      expect(res.end).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled(); // Should not send status if headers are sent
    });

    it('should return 500 and error message on failure', async () => {
      const errorMessage = 'Export error';
      mockedChatService.exportChatHistoryAsTxt.mockRejectedValue(new Error(errorMessage));

      await chatController.exportHistory(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Erro ao exportar histórico.', error: errorMessage });
    });
  });
});
