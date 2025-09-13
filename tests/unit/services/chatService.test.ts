import { chatService } from '../../../src/services/chatService';
import { ChatMessageModel } from '../../../src/models/chat';
import { Types } from 'mongoose';
import { IChatMessage } from '../../../src/types';

// Mocking de TODAS as dependências externas
jest.mock('../../../src/models/chat');

// Tipos mockados
const MockedChatMessageModel = ChatMessageModel as jest.MockedClass<typeof ChatMessageModel>;

describe('ChatService', () => {
  let chatServiceInstance: typeof chatService;

  // Mock ObjectIds consistentes para testes
  const mockRideId = new Types.ObjectId('507f1f77bcf86cd799439011');
  const mockSenderId = new Types.ObjectId('507f1f77bcf86cd799439012');
  const mockOtherUserId = new Types.ObjectId('507f1f77bcf86cd799439013');

  // Mock de mensagens de chat
  const mockMessages = [
    {
      _id: new Types.ObjectId('507f1f77bcf86cd799439014'),
      ride: mockRideId,
      sender: mockSenderId,
      content: 'Primeira mensagem',
      createdAt: new Date('2023-01-01T10:00:00.000Z')
    },
    {
      _id: new Types.ObjectId('507f1f77bcf86cd799439015'),
      ride: mockRideId,
      sender: mockOtherUserId,
      content: 'Segunda mensagem',
      createdAt: new Date('2023-01-01T10:05:00.000Z')
    },
    {
      _id: new Types.ObjectId('507f1f77bcf86cd799439016'),
      ride: mockRideId,
      sender: mockSenderId,
      content: 'Terceira mensagem',
      createdAt: new Date('2023-01-01T10:10:00.000Z')
    }
  ] as unknown as IChatMessage[];

  beforeEach(() => {
    // Limpar todos os mocks antes de cada teste para garantir isolamento
    jest.clearAllMocks();

    // Criar nova instância para cada teste
    chatServiceInstance = chatService;

    // Mock da query chain do Mongoose
    const mockQuery = {
      sort: jest.fn().mockReturnThis(),
    };
    MockedChatMessageModel.find = jest.fn().mockReturnValue(mockQuery);
    mockQuery.sort.mockResolvedValue(mockMessages);
  });

  describe('getChatHistory', () => {
    it('should return chat messages for given ride and sender', async () => {
      // Arrange
      const expectedQuery = {
        $or: [
          { ride: mockRideId },
          { sender: mockSenderId }
        ]
      };

      // Act
      const result = await chatServiceInstance.getChatHistory(mockRideId, mockSenderId);

      // Assert
      expect(MockedChatMessageModel.find).toHaveBeenCalledWith(expectedQuery);
      expect(MockedChatMessageModel.find).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockMessages);
    });

    it('should sort messages by createdAt in ascending order', async () => {
      // Arrange
      const mockQuery = {
        sort: jest.fn().mockResolvedValue(mockMessages)
      };
      MockedChatMessageModel.find = jest.fn().mockReturnValue(mockQuery);

      // Act
      await chatServiceInstance.getChatHistory(mockRideId, mockSenderId);

      // Assert
      expect(mockQuery.sort).toHaveBeenCalledWith({ createdAt: 1 });
      expect(mockQuery.sort).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when no messages found', async () => {
      // Arrange
      const mockQuery = {
        sort: jest.fn().mockResolvedValue([])
      };
      MockedChatMessageModel.find = jest.fn().mockReturnValue(mockQuery);

      // Act
      const result = await chatServiceInstance.getChatHistory(mockRideId, mockSenderId);

      // Assert
      expect(MockedChatMessageModel.find).toHaveBeenCalledWith({
        $or: [
          { ride: mockRideId },
          { sender: mockSenderId }
        ]
      });
      expect(result).toEqual([]);
    });

    it('should handle database query failure', async () => {
      // Arrange
      const mockQuery = {
        sort: jest.fn().mockRejectedValue(new Error('Database connection failed'))
      };
      MockedChatMessageModel.find = jest.fn().mockReturnValue(mockQuery);

      // Act & Assert
      await expect(chatServiceInstance.getChatHistory(mockRideId, mockSenderId))
        .rejects
        .toThrow('Database connection failed');

      expect(MockedChatMessageModel.find).toHaveBeenCalledTimes(1);
    });

    it('should handle null ObjectId parameters', async () => {
      // Act
      await chatServiceInstance.getChatHistory(null as any, null as any);

      // Assert
      expect(MockedChatMessageModel.find).toHaveBeenCalledWith({
        $or: [
          { ride: null },
          { sender: null }
        ]
      });
    });

    it('should handle different ObjectId combinations', async () => {
      // Arrange
      const differentRideId = new Types.ObjectId('507f1f77bcf86cd799439099');
      const differentSenderId = new Types.ObjectId('507f1f77bcf86cd799439088');

      // Act
      await chatServiceInstance.getChatHistory(differentRideId, differentSenderId);

      // Assert
      expect(MockedChatMessageModel.find).toHaveBeenCalledWith({
        $or: [
          { ride: differentRideId },
          { sender: differentSenderId }
        ]
      });
    });

    it('should handle find method failure', async () => {
      // Arrange
      MockedChatMessageModel.find = jest.fn().mockImplementation(() => {
        throw new Error('Find method failed');
      });

      // Act & Assert
      await expect(chatServiceInstance.getChatHistory(mockRideId, mockSenderId))
        .rejects
        .toThrow('Find method failed');
    });
  });

  describe('exportChatHistoryAsTxt', () => {
    beforeEach(() => {
      // Mock Date para testes determinísticos
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2023-06-15T14:30:00.000Z'));
    });

    afterEach(() => {
      // Restaurar timers reais
      jest.useRealTimers();
    });

    it('should export chat history as formatted text string', async () => {
      // Arrange
      const mockQuery = {
        sort: jest.fn().mockResolvedValue(mockMessages)
      };
      MockedChatMessageModel.find = jest.fn().mockReturnValue(mockQuery);

      const expectedHeader = `Histórico de Chat - Carona ${mockRideId}\nExportado em: 2023-06-15T14:30:00.000Z\n\n`;
      const fmt = (d: Date) => new Date(d).toLocaleString('pt-BR', { timeZone: 'UTC' });
      const expectedBody = [
        `[${fmt(new Date('2023-01-01T10:00:00.000Z'))}] Você: Primeira mensagem`,
        `[${fmt(new Date('2023-01-01T10:05:00.000Z'))}] Outro: Segunda mensagem`,
        `[${fmt(new Date('2023-01-01T10:10:00.000Z'))}] Você: Terceira mensagem`
      ].join('\n');
      const expectedResult = expectedHeader + expectedBody;

      // Act
      const result = await chatServiceInstance.exportChatHistoryAsTxt(mockRideId, mockSenderId);

      // Assert
      expect(MockedChatMessageModel.find).toHaveBeenCalledWith({
        $or: [
          { ride: mockRideId },
          { sender: mockSenderId }
        ]
      });
      expect(result).toBe(expectedResult);
    });

    it('should return default message when no messages found', async () => {
      // Arrange
      const mockQuery = {
        sort: jest.fn().mockResolvedValue([])
      };
      MockedChatMessageModel.find = jest.fn().mockReturnValue(mockQuery);

      // Act
      const result = await chatServiceInstance.exportChatHistoryAsTxt(mockRideId, mockSenderId);

      // Assert
      expect(result).toBe("Nenhuma mensagem nesta conversa.");
    });

    it('should correctly identify sender as "Você" when sender matches requesting user', async () => {
      // Arrange
      const messagesFromSender = [
        {
          _id: new Types.ObjectId('507f1f77bcf86cd799439017'),
          ride: mockRideId,
          sender: mockSenderId,
          content: 'Mensagem do próprio usuário',
          createdAt: new Date('2023-01-01T10:00:00.000Z')
        }
      ] as unknown as IChatMessage[];

      const mockQuery = {
        sort: jest.fn().mockResolvedValue(messagesFromSender)
      };
      MockedChatMessageModel.find = jest.fn().mockReturnValue(mockQuery);

      // Act
      const result = await chatServiceInstance.exportChatHistoryAsTxt(mockRideId, mockSenderId);

      // Assert
      expect(result).toContain('[01/01/2023, 10:00:00] Você: Mensagem do próprio usuário');
    });

    it('should correctly identify sender as "Outro" when sender differs from requesting user', async () => {
      // Arrange
      const messagesFromOther = [
        {
          _id: new Types.ObjectId('507f1f77bcf86cd799439018'),
          ride: mockRideId,
          sender: mockOtherUserId,
          content: 'Mensagem de outro usuário',
          createdAt: new Date('2023-01-01T10:00:00.000Z')
        }
      ] as unknown as IChatMessage[];

      const mockQuery = {
        sort: jest.fn().mockResolvedValue(messagesFromOther)
      };
      MockedChatMessageModel.find = jest.fn().mockReturnValue(mockQuery);

      // Act
      const result = await chatServiceInstance.exportChatHistoryAsTxt(mockRideId, mockSenderId);

      // Assert
      expect(result).toContain('[01/01/2023, 10:00:00] Outro: Mensagem de outro usuário');
    });

    it('should handle messages with special characters in content', async () => {
      // Arrange
      const specialMessages = [
        {
          _id: new Types.ObjectId('507f1f77bcf86cd799439019'),
          ride: mockRideId,
          sender: mockSenderId,
          content: 'Mensagem com símbolos: !@#$%^&*()_+-=[]{}|;:,.<>?',
          createdAt: new Date('2023-01-01T10:00:00.000Z')
        }
      ] as unknown as IChatMessage[];

      const mockQuery = {
        sort: jest.fn().mockResolvedValue(specialMessages)
      };
      MockedChatMessageModel.find = jest.fn().mockReturnValue(mockQuery);

      // Act
      const result = await chatServiceInstance.exportChatHistoryAsTxt(mockRideId, mockSenderId);

      // Assert
      expect(result).toContain('Mensagem com símbolos: !@#$%^&*()_+-=[]{}|;:,.<>?');
    });

    it('should handle messages with empty content', async () => {
      // Arrange
      const emptyMessages = [
        {
          _id: new Types.ObjectId('507f1f77bcf86cd79943901a'),
          ride: mockRideId,
          sender: mockSenderId,
          content: '',
          createdAt: new Date('2023-01-01T10:00:00.000Z')
        }
      ] as unknown as IChatMessage[];

      const mockQuery = {
        sort: jest.fn().mockResolvedValue(emptyMessages)
      };
      MockedChatMessageModel.find = jest.fn().mockReturnValue(mockQuery);

      // Act
      const result = await chatServiceInstance.exportChatHistoryAsTxt(mockRideId, mockSenderId);

      // Assert
      expect(result).toContain('[01/01/2023, 10:00:00] Você: ');
    });

    it('should handle messages with null content', async () => {
      // Arrange
      const nullMessages = [
        {
          _id: new Types.ObjectId('507f1f77bcf86cd79943901b'),
          ride: mockRideId,
          sender: mockSenderId,
          content: null as unknown as string | null,
          createdAt: new Date('2023-01-01T10:00:00.000Z')
        }
      ] as unknown as IChatMessage[];

      const mockQuery = {
        sort: jest.fn().mockResolvedValue(nullMessages)
      };
      MockedChatMessageModel.find = jest.fn().mockReturnValue(mockQuery);

      // Act
      const result = await chatServiceInstance.exportChatHistoryAsTxt(mockRideId, mockSenderId);

      // Assert
      expect(result).toContain('[01/01/2023, 10:00:00] Você: null');
    });

    it('should format multiple messages correctly', async () => {
      // Arrange
      const multipleMessages = [
        {
          _id: new Types.ObjectId('507f1f77bcf86cd79943901c'),
          ride: mockRideId,
          sender: mockSenderId,
          content: 'Primeira',
          createdAt: new Date('2023-01-01T10:00:00.000Z')
        },
        {
          _id: new Types.ObjectId('507f1f77bcf86cd79943901d'),
          ride: mockRideId,
          sender: mockOtherUserId,
          content: 'Segunda',
          createdAt: new Date('2023-01-01T10:05:00.000Z')
        }
      ] as unknown as IChatMessage[];

      const mockQuery = {
        sort: jest.fn().mockResolvedValue(multipleMessages)
      };
      MockedChatMessageModel.find = jest.fn().mockReturnValue(mockQuery);

      // Act
      const result = await chatServiceInstance.exportChatHistoryAsTxt(mockRideId, mockSenderId);

      // Assert
      expect(result).toContain('[01/01/2023, 10:00:00] Você: Primeira');
      expect(result).toContain('[01/01/2023, 10:05:00] Outro: Segunda');
      expect(result.split('\n')).toHaveLength(5); // Header (3 lines) + 2 messages
    });

    it('should handle getChatHistory failure', async () => {
      // Arrange
      const mockQuery = {
        sort: jest.fn().mockRejectedValue(new Error('Chat history failed'))
      };
      MockedChatMessageModel.find = jest.fn().mockReturnValue(mockQuery);

      // Act & Assert
      await expect(chatServiceInstance.exportChatHistoryAsTxt(mockRideId, mockSenderId))
        .rejects
        .toThrow('Chat history failed');
    });

    it('should use current ISO string for export timestamp', async () => {
      // Arrange
      const mockQuery = {
        sort: jest.fn().mockResolvedValue(mockMessages)
      };
      MockedChatMessageModel.find = jest.fn().mockReturnValue(mockQuery);

      // Act
      const result = await chatServiceInstance.exportChatHistoryAsTxt(mockRideId, mockSenderId);

      // Assert
      expect(result).toContain('Exportado em: 2023-06-15T14:30:00.000Z');
    });

    it('should handle different date locales consistently', async () => {
      // Arrange
      const dateInDifferentTimezone = [
        {
          _id: new Types.ObjectId('507f1f77bcf86cd79943901e'),
          ride: mockRideId,
          sender: mockSenderId,
          content: 'Teste timezone',
          createdAt: new Date('2023-12-25T23:59:59.999Z')
        }
      ] as unknown as IChatMessage[];

      const mockQuery = {
        sort: jest.fn().mockResolvedValue(dateInDifferentTimezone)
      };
      MockedChatMessageModel.find = jest.fn().mockReturnValue(mockQuery);

      // Act
      const result = await chatServiceInstance.exportChatHistoryAsTxt(mockRideId, mockSenderId);

      // Assert
      expect(result).toMatch(/\[.*\] Você: Teste timezone/);
    });

    it('should handle invalid date objects gracefully', async () => {
      // Arrange
      const invalidDateMessage = [
        {
          _id: new Types.ObjectId('507f1f77bcf86cd79943901f'),
          ride: mockRideId,
          sender: mockSenderId,
          content: 'Teste data inválida',
          createdAt: new Date('invalid-date') // NaN date
        }
      ] as unknown as IChatMessage[];

      const mockQuery = {
        sort: jest.fn().mockResolvedValue(invalidDateMessage)
      };
      MockedChatMessageModel.find = jest.fn().mockReturnValue(mockQuery);

      // Act
      const result = await chatServiceInstance.exportChatHistoryAsTxt(mockRideId, mockSenderId);

      // Assert
      expect(result).toContain('Você: Teste data inválida');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle undefined parameters in getChatHistory', async () => {
      // Act
      await chatServiceInstance.getChatHistory(undefined as unknown as Types.ObjectId, undefined as unknown as Types.ObjectId);

      // Assert
      expect(MockedChatMessageModel.find).toHaveBeenCalledWith({
        $or: [
          { ride: undefined },
          { sender: undefined }
        ]
      });
    });

    it('should handle undefined parameters in exportChatHistoryAsTxt', async () => {
      // Arrange
      const mockQuery = {
        sort: jest.fn().mockResolvedValue([])
      };
      MockedChatMessageModel.find = jest.fn().mockReturnValue(mockQuery);

      // Act
      const result = await chatServiceInstance.exportChatHistoryAsTxt(undefined as unknown as Types.ObjectId, undefined as unknown as Types.ObjectId);

      // Assert
      expect(result).toBe("Nenhuma mensagem nesta conversa.");
    });

    it('should handle ChatMessageModel.find returning null', async () => {
      // Arrange
      MockedChatMessageModel.find = jest.fn().mockReturnValue(null as unknown as ReturnType<typeof MockedChatMessageModel.find>);

      // Act & Assert
      await expect(chatServiceInstance.getChatHistory(mockRideId, mockSenderId))
        .rejects
        .toThrow();
    });

    it('should handle sort method returning null', async () => {
      // Arrange
      const mockQuery = {
        sort: jest.fn().mockResolvedValue(null)
      };
      MockedChatMessageModel.find = jest.fn().mockReturnValue(mockQuery);

      // Act
      const result = await chatServiceInstance.getChatHistory(mockRideId, mockSenderId);

      // Assert
      expect(result).toBeNull();
    });
  });
});
