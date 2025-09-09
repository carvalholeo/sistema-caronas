import { chatService } from '../../../src/services/chatService';
import { ChatMessageModel } from '../../../src/models/chat';
import mongoose from 'mongoose';
import { RideModel } from '../../../src/models/ride';
import { BlockModel } from '../../../src/models/block';
import { Server } from 'socket.io';

// Mock dependencies
jest.mock('../../../src/models/chat');

describe('ChatService', () => {
  let rideId: mongoose.Types.ObjectId;
  let userId: mongoose.Types.ObjectId;

  beforeEach(() => {
    jest.clearAllMocks();
    rideId = new mongoose.Types.ObjectId();
    userId = new mongoose.Types.ObjectId();
  });

  describe('getChatHistory', () => {
    it('should return chat messages for a given rideId and userId', async () => {
      const mockMessages = [
        { _id: 'msg1', content: 'Hello', sender: userId, createdAt: new Date() },
        { _id: 'msg2', content: 'Hi', sender: new mongoose.Types.ObjectId(), createdAt: new Date() },
      ];
      mockedChatMessageModel.find.mockReturnValue({ sort: jest.fn().mockResolvedValue(mockMessages) } as any);

      const result = await chatService.getChatHistory(rideId, userId);

      expect(mockedChatMessageModel.find).toHaveBeenCalledWith({
        $or: [
          { ride: rideId },
          { sender: userId },
        ],
      });
      expect(result).toEqual(mockMessages);
    });
  });

  describe('exportChatHistoryAsTxt', () => {
    it('should return "Nenhuma mensagem nesta conversa." if no messages are found', async () => {
      jest.spyOn(chatService, 'getChatHistory').mockResolvedValue([]);

      const result = await chatService.exportChatHistoryAsTxt(rideId, userId);

      expect(result).toBe('Nenhuma mensagem nesta conversa.');
    });

    it('should return correctly formatted text content', async () => {
      const otherUserId = new mongoose.Types.ObjectId();
      const mockMessages = [
        { _id: 'msg1', content: 'Hello', sender: userId, createdAt: new Date('2023-01-01T10:00:00Z') },
        { _id: 'msg2', content: 'Hi', sender: otherUserId, createdAt: new Date('2023-01-01T10:01:00Z') },
      ];
      jest.spyOn(chatService, 'getChatHistory').mockResolvedValue(mockMessages as any);

      const result = await chatService.exportChatHistoryAsTxt(rideId, userId);

      const expectedHeader = `Histórico de Chat - Carona ${rideId}\nExportado em: ${new Date().toISOString().split('T')[0]}`; // Date part only for simplicity
      const expectedBody = [
        `[${new Date('2023-01-01T10:00:00Z').toLocaleString()}] Você: Hello`,
        `[${new Date('2023-01-01T10:01:00Z').toLocaleString()}] Outro: Hi`,
      ].join('\n');

      expect(result).toContain(`Histórico de Chat - Carona ${rideId}`);
      expect(result).toContain(`[${new Date('2023-01-01T10:00:00Z').toLocaleString()}] Você: Hello`);
      expect(result).toContain(`[${new Date('2023-01-01T10:01:00Z').toLocaleString()}] Outro: Hi`);
    });
  });
});


// Mock dependencies
jest.mock('../../../src/models/chat');
jest.mock('../../../src/models/ride');
jest.mock('../../../src/models/block');

const mockedChatMessageModel = ChatMessageModel as jest.Mocked<typeof ChatMessageModel>;
const mockedRideModel = RideModel as jest.Mocked<typeof RideModel>;
const mockedBlockModel = BlockModel as jest.Mocked<typeof BlockModel>;

describe('ChatService', () => {
  let mockIo: Server;
  let senderId: mongoose.Types.ObjectId;
  let rideId: mongoose.Types.ObjectId;

  beforeEach(() => {
    jest.clearAllMocks();
    senderId = new mongoose.Types.ObjectId();
    rideId = new mongoose.Types.ObjectId();

    mockIo = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    } as unknown as Server;

    chatService.setIo(mockIo); // Assuming a setter for io

    // Mock ChatMessageModel.create
    mockedChatMessageModel.create.mockImplementation((data: any) => {
      return { ...data, _id: new mongoose.Types.ObjectId(), save: jest.fn().mockResolvedValue(true) };
    });
  });

  describe('sendMessage', () => {
    const messageContent = 'Hello, world!';

    it('should throw an error if ride is not found', async () => {
      mockedRideModel.findById.mockResolvedValue(null);
      await expect(chatService.sendMessage(rideId, senderId, messageContent)).rejects.toThrow('Carona não encontrada.');
    });

    it('should throw an error if sender is blocked by driver or vice-versa', async () => {
      const mockRide = { _id: rideId, driver: new mongoose.Types.ObjectId() };
      mockedRideModel.findById.mockResolvedValue(mockRide);
      mockedBlockModel.findOne.mockResolvedValue({}); // Simulate a block exists

      await expect(chatService.sendMessage(rideId, senderId, messageContent)).rejects.toThrow('Você está bloqueado por este usuário ou o bloqueou.');
    });

    it('should successfully send a message and emit to room', async () => {
      const mockRide = { _id: rideId, driver: new mongoose.Types.ObjectId() };
      mockedRideModel.findById.mockResolvedValue(mockRide);
      mockedBlockModel.findOne.mockResolvedValue(null);

      const result = await chatService.sendMessage(rideId, senderId, messageContent);

      expect(mockedChatMessageModel.create).toHaveBeenCalledWith({
        ride: rideId,
        sender: senderId,
        content: messageContent,
      });
      expect(mockIo.to).toHaveBeenCalledWith(rideId.toString());
      expect(mockIo.emit).toHaveBeenCalledWith('newMessage', expect.objectContaining({
        ride: rideId,
        sender: senderId,
        content: messageContent,
      }));
      expect(result.content).toBe(messageContent);
    });
  });

  describe('getMessages', () => {
    it('should return messages for a given rideId', async () => {
      const mockMessages = [
        { _id: 'msg1', content: 'Hi' },
        { _id: 'msg2', content: 'Hello' },
      ];
      mockedChatMessageModel.find.mockReturnValue({ populate: jest.fn().mockResolvedValue(mockMessages) } as any);

      const result = await chatService.getMessages(rideId);

      expect(mockedChatMessageModel.find).toHaveBeenCalledWith({ ride: rideId });
      expect(result).toEqual(mockMessages);
    });
  });

  describe('getChatParticipants', () => {
    it('should return driver and approved passengers', async () => {
      const driverId = new mongoose.Types.ObjectId();
      const passenger1Id = new mongoose.Types.ObjectId();
      const passenger2Id = new mongoose.Types.ObjectId();

      const mockRide = {
        _id: rideId,
        driver: { _id: driverId, name: 'Driver' },
        passengers: [
          { user: { _id: passenger1Id, name: 'Passenger1' }, status: 'approved' },
          { user: { _id: passenger2Id, name: 'Passenger2' }, status: 'pending' },
        ],
      };
      mockedRideModel.findById.mockResolvedValue(mockRide);

      const result = await chatService.getChatParticipants(rideId);

      expect(mockedRideModel.findById).toHaveBeenCalledWith(rideId);
      expect(result).toEqual(expect.arrayContaining([
        expect.objectContaining({ _id: driverId }),
        expect.objectContaining({ _id: passenger1Id }),
      ]));
      expect(result).toHaveLength(2);
    });

    it('should throw an error if ride is not found', async () => {
      mockedRideModel.findById.mockResolvedValue(null);
      await expect(chatService.getChatParticipants(rideId)).rejects.toThrow('Carona não encontrada.');
    });
  });
});