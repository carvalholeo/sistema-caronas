import { Request, Response } from "express";
import { rideController } from "../../../src/controllers/rideController";
import { rideService } from "../../../src/services/rideService";
import { IUser, IRide } from "../../../src/types";
import { Types } from "mongoose";

// Mockamos o service para isolar a lógica do controller.
jest.mock("../../../src/services/rideService");

const mockedRideService = rideService as jest.Mocked<typeof rideService>;

// Estende a interface global do Request para o escopo deste teste
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

describe("RideController (Unit)", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockUser: IUser;
  const mockRideId = new Types.ObjectId().toString() as unknown as IRide;

  beforeEach(() => {
    jest.clearAllMocks();

    mockUser = { _id: new Types.ObjectId().toString() } as IUser;

    mockRequest = {
      user: mockUser,
      body: {},
      params: {},
      query: {},
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  describe("create", () => {
    it("deve criar uma carona e retornar 201", async () => {
      const rideData = { origin: "A", destination: "B" };
      mockRequest.body = rideData;
      mockedRideService.createRide.mockResolvedValue({
        _id: mockRideId,
        ...rideData,
      } as any);

      await rideController.create(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockedRideService.createRide).toHaveBeenCalledWith(
        mockUser,
        rideData,
      );
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining(rideData),
      );
    });

    it("deve retornar 400 se o serviço lançar um erro", async () => {
      mockedRideService.createRide.mockRejectedValue(
        new Error("Validation failed"),
      );
      await rideController.create(
        mockRequest as Request,
        mockResponse as Response,
      );
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: "Validation failed",
      });
    });
  });

  describe("createRecurrent", () => {
    it("deve criar caronas recorrentes e retornar 201", async () => {
      const rideData = { origin: "A", recurrence: {} };
      mockRequest.body = rideData;
      const mockRides = [{ _id: mockRideId }];
      mockedRideService.createRecurrentRide.mockResolvedValue(mockRides as any);

      await rideController.createRecurrent(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockedRideService.createRecurrentRide).toHaveBeenCalledWith(
        mockUser,
        rideData,
      );
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(mockRides);
    });

    it("deve retornar 400 se o serviço lançar um erro", async () => {
      mockedRideService.createRecurrentRide.mockRejectedValue(
        new Error("No valid dates"),
      );
      await rideController.createRecurrent(
        mockRequest as Request,
        mockResponse as Response,
      );
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: "No valid dates",
      });
    });
  });

  describe("search", () => {
    it("deve buscar caronas e retornar 200", async () => {
      const searchParams = { from: "A", to: "B" };
      mockRequest.query = searchParams;
      const mockRides = [{ _id: mockRideId }];
      mockedRideService.searchRides.mockResolvedValue(mockRides);

      await rideController.search(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockedRideService.searchRides).toHaveBeenCalledWith(
        searchParams,
        mockUser,
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockRides);
    });

    it("deve retornar 500 em caso de erro no serviço", async () => {
      mockedRideService.searchRides.mockRejectedValue(
        new Error("Search failed"),
      );
      await rideController.search(
        mockRequest as Request,
        mockResponse as Response,
      );
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: expect.any(String),
        error: "Search failed",
      });
    });
  });

  describe("getMyRidesAsDriver", () => {
    it("deve retornar as caronas como motorista com status 200", async () => {
      const mockRides = [{ _id: mockRideId }];
      mockedRideService.getMyRidesAsDriver.mockResolvedValue(mockRides as any);

      await rideController.getMyRidesAsDriver(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockedRideService.getMyRidesAsDriver).toHaveBeenCalledWith(
        mockUser,
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockRides);
    });

    it("deve retornar 500 em caso de erro no serviço", async () => {
      mockedRideService.getMyRidesAsDriver.mockRejectedValue(
        new Error("DB Error"),
      );
      await rideController.getMyRidesAsDriver(
        mockRequest as Request,
        mockResponse as Response,
      );
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: expect.any(String),
        error: "DB Error",
      });
    });
  });

  describe("getMyRidesAsPassenger", () => {
    it("deve retornar as caronas como passageiro com status 200", async () => {
      const mockRides = [{ _id: mockRideId }];
      mockedRideService.getMyRidesAsPassenger.mockResolvedValue(
        mockRides as any,
      );

      await rideController.getMyRidesAsPassenger(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockedRideService.getMyRidesAsPassenger).toHaveBeenCalledWith(
        mockUser,
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockRides);
    });

    it("deve retornar 500 em caso de erro no serviço", async () => {
      mockedRideService.getMyRidesAsPassenger.mockRejectedValue(
        new Error("DB Error"),
      );
      await rideController.getMyRidesAsPassenger(
        mockRequest as Request,
        mockResponse as Response,
      );
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: expect.any(String),
        error: "DB Error",
      });
    });
  });

  describe("getDetails", () => {
    it("deve retornar os detalhes da carona com status 200", async () => {
      mockRequest.params = { id: mockRideId as any };
      const mockRideDetails = { _id: mockRideId };
      mockedRideService.getRideDetails.mockResolvedValue(mockRideDetails);

      await rideController.getDetails(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockedRideService.getRideDetails).toHaveBeenCalledWith(
        mockRideId,
        mockUser,
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockRideDetails);
    });

    it("deve retornar 403 se o serviço lançar um erro de acesso", async () => {
      mockRequest.params = { id: mockRideId as any };
      mockedRideService.getRideDetails.mockRejectedValue(
        new Error("Acesso negado"),
      );
      await rideController.getDetails(
        mockRequest as Request,
        mockResponse as Response,
      );
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: "Acesso negado",
      });
    });
  });

  describe("update", () => {
    it("deve atualizar uma carona e retornar 200", async () => {
      const updateData = { price: 150 };
      mockRequest.params = { id: mockRideId as any };
      mockRequest.body = updateData;
      const mockUpdatedRide = { _id: mockRideId, price: 150 };
      mockedRideService.updateRide.mockResolvedValue(mockUpdatedRide as any);

      await rideController.update(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockedRideService.updateRide).toHaveBeenCalledWith(
        mockRideId,
        mockUser,
        updateData,
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockUpdatedRide);
    });

    it("deve retornar 403 se o serviço lançar um erro de permissão", async () => {
      mockRequest.params = { id: mockRideId as any };
      mockedRideService.updateRide.mockRejectedValue(
        new Error("Acesso negado"),
      );
      await rideController.update(
        mockRequest as Request,
        mockResponse as Response,
      );
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: "Acesso negado",
      });
    });
  });

  describe("requestSeat", () => {
    it("deve solicitar uma vaga e retornar 200", async () => {
      mockRequest.params = { id: mockRideId as any };
      const mockUpdatedRide = { _id: mockRideId };
      mockedRideService.requestSeat.mockResolvedValue(mockUpdatedRide as any);

      await rideController.requestSeat(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockedRideService.requestSeat).toHaveBeenCalledWith(
        mockRideId,
        mockUser,
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockUpdatedRide);
    });

    it("deve retornar 400 se o serviço lançar um erro de validação", async () => {
      mockRequest.params = { id: mockRideId as any };
      mockedRideService.requestSeat.mockRejectedValue(new Error("Sem vagas"));
      await rideController.requestSeat(
        mockRequest as Request,
        mockResponse as Response,
      );
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ message: "Sem vagas" });
    });
  });

  describe("manageSeatRequest", () => {
    it("deve gerenciar uma solicitação de vaga e retornar 200", async () => {
      const passengerId = new Types.ObjectId().toString() as unknown as IUser;
      mockRequest.params = {
        id: mockRideId as any,
        passengerId: passengerId as any,
      };
      mockRequest.body = { action: "approve" };
      const mockManagedRide = { _id: mockRideId };
      mockedRideService.manageSeatRequest.mockResolvedValue(
        mockManagedRide as any,
      );

      await rideController.manageSeatRequest(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockedRideService.manageSeatRequest).toHaveBeenCalledWith(
        mockRideId,
        mockUser,
        passengerId,
        "approve",
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockManagedRide);
    });

    it("deve retornar 403 se o serviço lançar um erro de permissão", async () => {
      mockRequest.params = { id: mockRideId as any, passengerId: "pid" as any };
      mockedRideService.manageSeatRequest.mockRejectedValue(
        new Error("Não pertence ao motorista"),
      );
      await rideController.manageSeatRequest(
        mockRequest as Request,
        mockResponse as Response,
      );
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: "Não pertence ao motorista",
      });
    });
  });

  describe("cancelByDriver", () => {
    it("deve cancelar uma carona e retornar 200 com uma mensagem", async () => {
      mockRequest.params = { id: mockRideId as any };
      const mockCancelledRide = { _id: mockRideId };
      mockedRideService.cancelRideByDriver.mockResolvedValue(
        mockCancelledRide as any,
      );

      await rideController.cancelByDriver(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockedRideService.cancelRideByDriver).toHaveBeenCalledWith(
        mockRideId,
        mockUser,
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: "Carona cancelada com sucesso.",
        ride: mockCancelledRide,
      });
    });

    it("deve retornar 403 se o serviço lançar um erro", async () => {
      mockRequest.params = { id: mockRideId as any };
      mockedRideService.cancelRideByDriver.mockRejectedValue(
        new Error("Não foi possível cancelar"),
      );
      await rideController.cancelByDriver(
        mockRequest as Request,
        mockResponse as Response,
      );
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: "Não foi possível cancelar",
      });
    });
  });

  describe("cancelByPassenger", () => {
    it("deve cancelar uma reserva e retornar 200 com uma mensagem", async () => {
      mockRequest.params = { id: mockRideId as any };
      const mockUpdatedRide = { _id: mockRideId };
      mockedRideService.cancelSeatByPassenger.mockResolvedValue(
        mockUpdatedRide as any,
      );

      await rideController.cancelByPassenger(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockedRideService.cancelSeatByPassenger).toHaveBeenCalledWith(
        mockRideId,
        mockUser,
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: "Reserva cancelada com sucesso.",
        ride: mockUpdatedRide,
      });
    });

    it("deve retornar 403 se o serviço lançar um erro", async () => {
      mockRequest.params = { id: mockRideId as any };
      mockedRideService.cancelSeatByPassenger.mockRejectedValue(
        new Error("Reserva não encontrada"),
      );
      await rideController.cancelByPassenger(
        mockRequest as Request,
        mockResponse as Response,
      );
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: "Reserva não encontrada",
      });
    });
  });
});
