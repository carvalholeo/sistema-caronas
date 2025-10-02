// tests/unit/controllers/userController.test.ts

import { Request, Response } from "express";
import { Types } from "mongoose";
import {
  updateProfilePicture,
  getUserProfile,
  updateUserProfile,
  approveUserRegistration,
} from "../../../src/controllers/userController"; // Ajuste o caminho
import { UserService } from "../../../src/services/userService";
import { IUser } from "../../../src/types";

// Mockamos a instância do serviço usada pelo controller
jest.mock("../../../src/services/userService");

// Estendemos a interface global do Request para o escopo deste teste
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
      file?: Multer.File; // Adiciona a propriedade 'file' do Multer
    }
  }
}

describe("UserController (Unit)", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockUser: IUser;

  // Acessamos a instância mockada para controlar seus métodos
  const MockedUserService = UserService as jest.MockedClass<typeof UserService>;
  // Pegamos a instância que o Jest criou para o mock
  const mockedUserServiceInstance = MockedUserService.mock.instances[0];

  beforeEach(() => {
    jest.clearAllMocks();

    mockUser = { _id: new Types.ObjectId().toString() } as IUser;

    mockRequest = {
      user: mockUser,
      body: {},
      params: {},
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  describe("updateProfilePicture", () => {
    it("deve retornar 400 se nenhum arquivo for enviado", async () => {
      // Arrange
      mockRequest.file = undefined;

      // Act
      await updateProfilePicture(
        mockRequest as Request,
        mockResponse as Response,
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: "Nenhum arquivo enviado.",
      });
    });

    it("deve atualizar a foto de perfil e retornar 200 em caso de sucesso", async () => {
      // Arrange
      mockRequest.file = { originalname: "avatar.jpg" } as Express.Multer.File;
      const updatedUser = {
        ...mockUser,
        profilePictureUrl: "http://example.com/avatar.jpg",
      } as IUser;
      jest
        .spyOn(MockedUserService.prototype, "updateProfilePicture")
        .mockResolvedValue(updatedUser as any);

      // Act
      await updateProfilePicture(
        mockRequest as Request,
        mockResponse as Response,
      );

      // Assert
      expect(
        mockedUserServiceInstance.updateProfilePicture,
      ).toHaveBeenCalledWith(mockUser._id, mockRequest.file);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: "Foto de perfil atualizada com sucesso.",
        profilePictureUrl: updatedUser.profilePictureUrl,
      });
    });

    it("deve retornar 500 se o serviço lançar um erro", async () => {
      // Arrange
      mockRequest.file = { originalname: "avatar.jpg" } as Express.Multer.File;
      const errorMessage = "Erro no S3";
      jest
        .spyOn(MockedUserService.prototype, "updateProfilePicture")
        .mockRejectedValue(new Error(errorMessage));

      // Act
      await updateProfilePicture(
        mockRequest as Request,
        mockResponse as Response,
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: "Erro ao atualizar a foto de perfil.",
        error: errorMessage,
      });
    });
  });

  describe("getUserProfile", () => {
    it("deve retornar o perfil do usuário com status 200", async () => {
      // Arrange
      const userId = new Types.ObjectId().toString();
      mockRequest.params = { id: userId };
      jest
        .spyOn(MockedUserService.prototype, "getUserById")
        .mockResolvedValue(mockUser as any);

      // Act
      await getUserProfile(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockedUserServiceInstance.getUserById).toHaveBeenCalledWith(
        userId,
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockUser);
    });

    it("deve retornar 404 se o usuário não for encontrado", async () => {
      // Arrange
      mockRequest.params = { id: "non-existent-id" };
      jest
        .spyOn(MockedUserService.prototype, "getUserById")
        .mockResolvedValue(null);

      // Act
      await getUserProfile(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: "User not found",
      });
    });
  });

  describe("updateUserProfile", () => {
    it("deve atualizar o perfil e retornar 200", async () => {
      // Arrange
      const userId = new Types.ObjectId().toString();
      const updateData = { name: "New Name" };
      mockRequest.params = { id: userId };
      mockRequest.body = updateData;
      const updatedUser = { ...mockUser, name: "New Name" };
      jest
        .spyOn(MockedUserService.prototype, "updateUser")
        .mockResolvedValue(updatedUser as any);

      // Act
      await updateUserProfile(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockedUserServiceInstance.updateUser).toHaveBeenCalledWith(
        userId,
        updateData,
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(updatedUser);
    });
  });

  describe("approveUserRegistration", () => {
    it("deve aprovar o registro e retornar 200", async () => {
      // Arrange
      const userId = new Types.ObjectId().toString();
      mockRequest.params = { id: userId };
      const approvedUser = { ...mockUser, status: "approved" };
      jest
        .spyOn(mockedUserServiceInstance, "approveUser")
        .mockResolvedValue(approvedUser);

      // Act
      await approveUserRegistration(
        mockRequest as Request,
        mockResponse as Response,
      );

      // Assert
      expect(mockedUserServiceInstance.approveUser).toHaveBeenCalledWith(
        userId,
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(approvedUser);
    });
  });
});
