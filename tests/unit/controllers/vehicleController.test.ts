import { Request, Response } from "express";
import { Types } from "mongoose";
import { vehicleController } from "../../../src/controllers/vehicleController";
import { vehicleService } from "../../../src/services/vehicleService";
import { IUser } from "../../../src/types";

// Mockamos o service para isolar a lógica do controller.
jest.mock("../../../src/services/vehicleService");

const mockedVehicleService = vehicleService as jest.Mocked<
  typeof vehicleService
>;

// Estende a interface global do Request para o escopo deste teste
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

describe("VehicleController (Unit)", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockUser: IUser;

  beforeEach(() => {
    jest.clearAllMocks();

    mockUser = { _id: new Types.ObjectId().toString() } as IUser;

    mockRequest = {
      user: mockUser,
      body: {},
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  describe("create", () => {
    const vehicleData = {
      plate: "ABC-1234",
      make: "Honda",
      model: "Civic",
    };

    it("deve criar um veículo e retornar status 201", async () => {
      // Arrange
      mockRequest.body = vehicleData;
      const mockCreatedVehicle = { _id: new Types.ObjectId(), ...vehicleData };
      mockedVehicleService.createVehicle.mockResolvedValue(
        mockCreatedVehicle as any,
      );

      // Act
      await vehicleController.create(
        mockRequest as Request,
        mockResponse as Response,
      );

      // Assert
      expect(mockedVehicleService.createVehicle).toHaveBeenCalledWith(
        mockUser,
        vehicleData,
      );
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(mockCreatedVehicle);
    });

    it("deve retornar status 500 se o serviço lançar um erro", async () => {
      // Arrange
      mockRequest.body = vehicleData;
      const errorMessage = "Erro ao salvar no banco de dados";
      mockedVehicleService.createVehicle.mockRejectedValue(
        new Error(errorMessage),
      );

      // Act
      await vehicleController.create(
        mockRequest as Request,
        mockResponse as Response,
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: "Erro ao cadastrar veículo.",
        error: errorMessage,
      });
    });
  });

  describe("getMyVehicles", () => {
    it("deve buscar e retornar os veículos do usuário com status 200", async () => {
      // Arrange
      const mockVehicles = [
        { _id: new Types.ObjectId(), plate: "ABC-1234" },
        { _id: new Types.ObjectId(), plate: "XYZ-5678" },
      ];
      mockedVehicleService.getVehiclesByOwner.mockResolvedValue(
        mockVehicles as any,
      );

      // Act
      await vehicleController.getMyVehicles(
        mockRequest as Request,
        mockResponse as Response,
      );

      // Assert
      expect(mockedVehicleService.getVehiclesByOwner).toHaveBeenCalledWith(
        mockUser,
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockVehicles);
    });

    it("deve retornar status 500 se o serviço lançar um erro", async () => {
      // Arrange
      const errorMessage = "Erro ao buscar no banco de dados";
      mockedVehicleService.getVehiclesByOwner.mockRejectedValue(
        new Error(errorMessage),
      );

      // Act
      await vehicleController.getMyVehicles(
        mockRequest as Request,
        mockResponse as Response,
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: "Erro ao buscar veículos.",
        error: errorMessage,
      });
    });
  });
});
