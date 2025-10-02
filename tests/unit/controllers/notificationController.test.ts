// tests/unit/controllers/notificationController.test.ts

import { Request, Response } from "express";
import { Types } from "mongoose";

// Importamos o controller e o service
import { notificationController } from "../../../src/controllers/notificationController";
import { notificationService } from "../../../src/services/notificationService";
import { IUser } from "../../../src/types";

// Mockamos o service para isolar o controller
jest.mock("../../../src/services/notificationService");

const mockedNotificationService = notificationService as jest.Mocked<
  typeof notificationService
>;

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

describe("NotificationController (Unit)", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockUser: IUser;

  // Criamos mocks reutilizáveis para os objetos 'req' e 'res'
  beforeEach(() => {
    jest.clearAllMocks();

    mockUser = {
      _id: new Types.ObjectId().toString(),
      name: "Test User",
    } as IUser;

    mockRequest = {
      user: mockUser, // Simulando o usuário autenticado
      body: {},
      params: {},
    };

    // Mock do 'res' com funções espiãs para 'status' e 'json'
    mockResponse = {
      status: jest.fn().mockReturnThis(), // .mockReturnThis() permite encadear chamadas, ex: res.status(200).json(...)
      json: jest.fn(),
    };
  });

  describe("subscribe", () => {
    it("deve chamar o serviço e retornar 201 em caso de sucesso", async () => {
      // Arrange
      mockRequest.body = { platform: "web", endpoint: "https://example.com" };
      const mockNewSubscription = {
        _id: new Types.ObjectId(),
        ...mockRequest.body,
      };
      mockedNotificationService.subscribe.mockResolvedValue(
        mockNewSubscription as any,
      );

      // Act: Chama o método do controller diretamente com os mocks
      await notificationController.subscribe(
        mockRequest as Request,
        mockResponse as Response,
      );

      // Assert
      // 1. Verifica se o serviço foi chamado corretamente
      expect(mockedNotificationService.subscribe).toHaveBeenCalledWith({
        user: mockUser,
        ...mockRequest.body,
      });
      // 2. Verifica se a resposta HTTP foi enviada corretamente
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(mockNewSubscription);
    });

    it("deve retornar 500 se o serviço lançar um erro", async () => {
      // Arrange
      const errorMessage = "Falha no banco de dados";
      mockedNotificationService.subscribe.mockRejectedValue(
        new Error(errorMessage),
      );
      mockRequest.body = { platform: "web" };

      // Act
      await notificationController.subscribe(
        mockRequest as Request,
        mockResponse as Response,
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: expect.any(String),
        error: errorMessage,
      });
    });
  });

  describe("updatePreferences", () => {
    const deviceIdentifier = "device-123";
    const preferencesData = { kinds: { rides: true } };

    beforeEach(() => {
      mockRequest.params = { deviceIdentifier };
      mockRequest.body = preferencesData;
    });

    it("deve chamar o serviço e retornar 200 em caso de sucesso", async () => {
      // Arrange
      const mockUpdatedSubscription = {
        _id: new Types.ObjectId(),
        ...preferencesData,
      };
      mockedNotificationService.updatePreferences.mockResolvedValue(
        mockUpdatedSubscription as any,
      );

      // Act
      await notificationController.updatePreferences(
        mockRequest as Request,
        mockResponse as Response,
      );

      // Assert
      expect(mockedNotificationService.updatePreferences).toHaveBeenCalledWith(
        mockUser,
        deviceIdentifier,
        preferencesData,
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockUpdatedSubscription);
    });

    it("deve retornar 404 se o serviço informar que a assinatura não foi encontrada", async () => {
      // Arrange
      const errorMessage = "Assinatura não encontrada";
      mockedNotificationService.updatePreferences.mockRejectedValue(
        new Error(errorMessage),
      );

      // Act
      await notificationController.updatePreferences(
        mockRequest as Request,
        mockResponse as Response,
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({ message: errorMessage });
    });

    it("deve retornar 500 para outros erros do serviço", async () => {
      // Arrange
      const errorMessage = "Erro genérico";
      mockedNotificationService.updatePreferences.mockRejectedValue(
        new Error(errorMessage),
      );

      // Act
      await notificationController.updatePreferences(
        mockRequest as Request,
        mockResponse as Response,
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: expect.any(String),
        error: errorMessage,
      });
    });
  });
});
