import { rideService } from "../../../src/services/rideService";
import { RideModel } from "../../../src/models/ride";
import { VehicleModel } from "../../../src/models/vehicle";
import {
  SearchEventModel,
  RideViewEventModel,
} from "../../../src/models/event";
import mongoose, { Types } from "mongoose";
import { randomUUID } from "crypto";
import {
  VehicleStatus,
  RideStatus,
  UserRole,
  PassengerStatus,
} from "../../../src/types/enums/enums";
import { IRide, IRidePassenger, IUser, IVehicle } from "../../../src/types/";

// Mock dependencies
jest.mock("../../../src/models/ride");
jest.mock("../../../src/models/vehicle");
jest.mock("../../../src/models/event");
jest.mock("../../../src/models/user");
jest.mock("crypto", () => ({
  __esModule: true,
  ...jest.requireActual("crypto"),
  randomUUID: jest.fn().mockReturnValue("mock-uuid"),
}));

const mockedRideModel = RideModel as jest.Mocked<typeof RideModel>;
const mockedVehicleModel = VehicleModel as jest.Mocked<typeof VehicleModel>;
const mockedSearchEventModel = SearchEventModel as jest.Mocked<
  typeof SearchEventModel
>;
const mockedRideViewEventModel = RideViewEventModel as jest.Mocked<
  typeof RideViewEventModel
>;
const mockedRandomUUID = randomUUID as jest.Mock;

describe("RideService", () => {
  let mockVehicle: IVehicle;
  let mockRide: IRide;
  let mockPassenger: IUser;
  let mockDriver: IUser;

  beforeEach(() => {
    jest.clearAllMocks();

    mockPassenger = { _id: new mongoose.Types.ObjectId() } as IUser;

    mockDriver = {
      _id: new mongoose.Types.ObjectId(),
      name: "Driver Test",
      email: "abcd@efgh.com",
      matricula: "a123456",
      roles: [UserRole.Motorista],
    } as unknown as IUser;

    mockVehicle = {
      _id: new mongoose.Types.ObjectId(),
      owner: mockDriver,
      status: VehicleStatus.Active,
      capacity: 4,
    } as unknown as IVehicle;

    mockRide = {
      _id: new mongoose.Types.ObjectId(),
      driver: mockDriver,
      vehicle: mockVehicle,
      availableSeats: 3,
      passengers: [],
      price: 100,
      status: RideStatus.Scheduled,
      save: jest.fn().mockResolvedValue(true),
      toObject: jest.fn().mockReturnThis(),
    } as unknown as IRide;

    mockedVehicleModel.findOne.mockResolvedValue(mockVehicle);
    (mockedRideModel as unknown as jest.Mock).mockImplementation(
      () => mockRide,
    );
    mockedRideModel.insertMany.mockResolvedValue([mockRide as any]);
    mockedRideModel.findById.mockResolvedValue(mockRide);
    mockedRideModel.findOne.mockResolvedValue(mockRide);
    mockedRideModel.find.mockResolvedValue([mockRide as any]);
    mockedRideModel.findOneAndUpdate.mockResolvedValue(mockRide);
  });

  (mockedSearchEventModel as unknown as jest.Mock).mockImplementation(() => ({
    create: jest.fn().mockResolvedValue(true),
  }));
  (mockedRideViewEventModel as unknown as jest.Mock).mockImplementation(() => ({
    create: jest.fn().mockResolvedValue(true),
  }));

  describe("createRide", () => {
    const rideData = {
      vehicle: mockVehicle,
      driver: mockDriver,
      origin: { location: "A", point: { coordinates: [0, 0] } },
      destination: { location: "B", point: { coordinates: [1, 1] } },
      departureTime: new Date(),
      availableSeats: 3,
      price: 10,
    };

    it("should successfully create a ride", async () => {
      // Arrange
      mockedVehicleModel.findOne.mockResolvedValue(mockVehicle);
      const mockSave = jest.fn().mockResolvedValue(true);
      (mockedRideModel as any).mockImplementation(() => ({ save: mockSave }));

      // Act
      await rideService.createRide(mockDriver, rideData);

      // Assert
      expect(mockedRideModel).toHaveBeenCalledWith(
        expect.objectContaining({ driver: mockDriver }),
      );
      expect(mockSave).toHaveBeenCalledTimes(1);
    });

    it("should throw an error if vehicle is not found or not owned by driver", async () => {
      mockedVehicleModel.findOne.mockResolvedValue(null);
      await expect(
        rideService.createRide(mockDriver, rideData),
      ).rejects.toThrow("Veículo inválido ou não pertence ao motorista.");
    });

    it("should throw an error if vehicle is not active", async () => {
      mockVehicle.status = VehicleStatus.Inactive;
      await expect(
        rideService.createRide(mockDriver, rideData),
      ).rejects.toThrow("Veículo inválido ou não pertence ao motorista.");
    });

    it("should throw an error if available seats exceed vehicle capacity", async () => {
      const invalidRideData = { ...rideData, availableSeats: 5 };
      await expect(
        rideService.createRide(mockDriver, invalidRideData),
      ).rejects.toThrow(
        "A quantidade de assentos excede a capacidade do veículo.",
      );
    });

    it("should successfully create a ride", async () => {
      const result = await rideService.createRide(mockDriver, rideData);

      expect(mockedRideModel).toHaveBeenCalledWith(
        expect.objectContaining({
          ...rideData,
          driver: mockDriver,
        }),
      );
      expect(mockRide.save).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockRide);
    });
  });

  describe("createRecurrentRide", () => {
    const recurrenceData = {
      daysOfWeek: [1, 2],
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    };
    const rideData = {
      ...mockRide,
      driver: mockDriver,
      vehicle: mockVehicle,
      origin: { location: "A", point: { coordinates: [0, 0] } },
      destination: { location: "B", point: { coordinates: [1, 1] } },
      departureTime: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours from now
      price: 10,
      recurrence: recurrenceData,
    } as unknown as IRide;

    it("should throw an error if vehicle is invalid or not active", async () => {
      mockedVehicleModel.findOne.mockResolvedValue(null);
      await expect(
        rideService.createRecurrentRide(mockDriver, rideData),
      ).rejects.toThrow("Veículo inválido ou não pertence ao motorista.");
    });

    it("should throw an error if available seats exceed vehicle capacity", async () => {
      const invalidRideData = { ...rideData, availableSeats: 5 };
      await expect(
        rideService.createRecurrentRide(mockDriver, invalidRideData),
      ).rejects.toThrow(
        "A quantidade de assentos excede a capacidade do veículo.",
      );
    });

    it("should throw an error if no valid dates for recurrence", async () => {
      const invalidRecurrenceData = {
        ...rideData,
        recurrence: { ...recurrenceData, endDate: new Date(Date.now() - 1000) },
      };
      await expect(
        rideService.createRecurrentRide(mockDriver, invalidRecurrenceData),
      ).rejects.toThrow("Nenhuma data válida para a recorrência.");
    });

    it("should successfully create recurrent rides", async () => {
      const rideForRecurrence = {
        ...mockRide,
        driver: mockDriver,
        vehicle: mockVehicle,
        origin: { location: "A", point: { coordinates: [0, 0] } },
        destination: { location: "B", point: { coordinates: [1, 1] } },
        departureTime: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours from now
        price: 10,
        recurrence: recurrenceData,
      } as unknown as IRide;

      mockedRandomUUID.mockReturnValue("mock-uuid");
      mockedRideModel.insertMany.mockResolvedValue([rideForRecurrence as any]);

      const result = await rideService.createRecurrentRide(
        mockDriver,
        rideForRecurrence,
      );
      const ridesToCreate = mockedRideModel.insertMany.mock
        .calls[0][0] as Partial<IRide>[];

      expect(mockedRideModel.insertMany).toHaveBeenCalledTimes(1);
      expect(ridesToCreate.length).toBeGreaterThan(0);

      expect(ridesToCreate[0]).toMatchObject({
        driver: mockDriver,
        vehicle: mockVehicle,
        origin: { location: "A", point: { coordinates: [0, 0] } },
        destination: { location: "B", point: { coordinates: [1, 1] } },
        price: 10,
        availableSeats: mockRide.availableSeats,
        status: RideStatus.Scheduled,
        isRecurrent: true,
        recurrenceId: "mock-uuid",
      });

      expect(ridesToCreate[0].departureTime).toBeInstanceOf(Date);
      expect(
        ridesToCreate[0].departureTime?.getUTCDate(),
      ).toBeGreaterThanOrEqual(rideData.departureTime.getUTCDate());
    });
  });

  describe("updateRide", () => {
    it("should successfully update a ride", async () => {
      // Arrange
      // const mockRideInstance = {
      //   _id: new Types.ObjectId(),
      //   driver: mockDriver._id,
      //   status: RideStatus.Scheduled,
      //   passengers: [],
      //   departureTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 horas no futuro
      //   price: 50,
      //   save: jest.fn().mockResolvedValue(this),
      // };
      // mockedRideModel.findById.mockResolvedValue(mockRideInstance as any);

      // Act
      const updatedRide = await rideService.updateRide(
        mockRide._id as any,
        mockDriver,
        { price: 100 },
      );

      // Assert
      expect(mockedRideModel.findById).toHaveBeenCalledWith(mockRide._id);
      expect(mockRide.price).toBe(100);
      expect(mockRide.save).toHaveBeenCalledTimes(1);
      expect(updatedRide).toBeDefined();
    });

    it("should throw an error if ride has passengers", async () => {
      // Arrange
      const mockRideWithPassengers = {
        ...mockRide,
        passengers: [{ user: mockPassenger._id }],
      };
      mockedRideModel.findById.mockResolvedValue(mockRideWithPassengers as any);

      // Act & Assert
      await expect(
        rideService.updateRide("rideId" as any, mockDriver, {}),
      ).rejects.toThrow("Caronas com passageiros não podem ser editadas.");
    });
  });

  describe("requestSeat", () => {
    it("should add a passenger with pending status to the ride", async () => {
      // Arrange
      const mockRideInstance = {
        _id: new Types.ObjectId(),
        driver: mockDriver._id,
        availableSeats: 3,
        passengers: [] as IRidePassenger[],
        save: jest.fn().mockResolvedValue(this),
      };
      mockedRideModel.findById.mockResolvedValue(mockRideInstance as any);

      // Act
      await rideService.requestSeat(mockRideInstance._id as any, mockPassenger);

      // Assert
      expect(mockRideInstance.passengers.length).toBe(1);
      expect(mockRideInstance.passengers[0].user).toBe(mockPassenger);
      expect(mockRideInstance.passengers[0].status).toBe(
        PassengerStatus.Pending,
      );
      expect(mockRideInstance.save).toHaveBeenCalledTimes(1);
    });

    it("should throw an error if no seats are available", async () => {
      // Arrange
      const mockFullRide = {
        driver: mockDriver._id,
        availableSeats: 0,
        passengers: [],
      };
      mockedRideModel.findById.mockResolvedValue(mockFullRide as any);

      // Act & Assert
      await expect(
        rideService.requestSeat("rideId" as any, mockPassenger),
      ).rejects.toThrow("Não há assentos disponíveis.");
    });
  });

  describe("manageSeatRequest", () => {
    it("should approve a passenger and decrement available seats", async () => {
      // Arrange
      const mockRideInstance = {
        _id: new Types.ObjectId(),
        driver: mockDriver._id,
        availableSeats: 3,
        passengers: [{ user: mockPassenger, status: PassengerStatus.Pending }],
        save: jest.fn().mockResolvedValue(this),
      };
      mockedRideModel.findOne.mockResolvedValue(mockRideInstance as any);

      // Act
      await rideService.manageSeatRequest(
        mockRideInstance._id as any,
        mockDriver,
        mockPassenger,
        "approve",
      );

      // Assert
      expect(mockRideInstance.passengers[0].status).toBe(
        PassengerStatus.Approved,
      );
      expect(mockRideInstance.availableSeats).toBe(2);
      expect(mockRideInstance.save).toHaveBeenCalledTimes(1);
    });

    it("should reject a passenger and not change available seats", async () => {
      // Arrange
      const mockRideInstance = {
        ...mockRide,
        availableSeats: 3,
        passengers: [{ user: mockPassenger, status: PassengerStatus.Pending }],
        save: jest.fn().mockResolvedValue(this),
      };

      mockedRideModel.findOne.mockResolvedValue(mockRideInstance as any);

      // Act
      await rideService.manageSeatRequest(
        mockRideInstance._id as any,
        mockDriver,
        mockPassenger,
        "reject",
      );

      // Assert
      expect(mockRideInstance.passengers[0].status).toBe(
        PassengerStatus.Rejected,
      );
      expect(mockRideInstance.availableSeats).toBe(3); // Permanece o mesmo
      expect(mockRideInstance.save).toHaveBeenCalledTimes(1);
    });
  });

  describe("searchRides", () => {
    it("should call the aggregation pipeline and create a search event", async () => {
      // Arrange
      const mockAggResult = [{ _id: "ride1" }, { _id: "ride2" }];
      mockedRideModel.aggregate.mockResolvedValue(mockAggResult);
      const createEventSpy = jest.fn().mockResolvedValue(true);
      (mockedSearchEventModel.create as jest.Mock) = createEventSpy;

      const searchParams = {
        from: [-46, -23],
        to: [-47, -22],
        date: new Date(),
      };

      // Act
      const result = await rideService.searchRides(searchParams, mockPassenger);

      // Assert
      expect(mockedRideModel.aggregate).toHaveBeenCalledTimes(1);
      expect(createEventSpy).toHaveBeenCalledWith({
        user: mockPassenger,
        durationMs: expect.any(Number),
        resultsCount: mockAggResult.length,
      });
      expect(result).toEqual(mockAggResult);
    });
  });

  describe("getRideDetails", () => {
    it("should throw an error for a user not involved in the ride", async () => {
      // Arrange
      const mockRideDetails = {
        _id: new Types.ObjectId(),
        driver: { _id: mockDriver._id },
        passengers: [],
        toObject: () => mockRideDetails,
      };
      // Simula o encadeamento de .populate()
      const populateMock = {
        populate: jest.fn().mockResolvedValue(mockRideDetails),
      };
      const mockQuery = {
        populate: jest.fn().mockReturnValue(populateMock),
      };
      mockedRideModel.findById.mockReturnValue(mockQuery as any);

      const unathorizedUser = { _id: new Types.ObjectId() } as IUser;

      // Act & Assert
      await expect(
        rideService.getRideDetails(mockRideDetails._id as any, unathorizedUser),
      ).rejects.toThrow("Acesso negado aos detalhes da carona.");
    });
  });

  describe("cancelSeatByPassenger", () => {
    it("should cancel an approved seat and increment available seats", async () => {
      // Arrange
      const mockRideInstance = {
        ...mockRide,
        availableSeats: 2,
        passengers: [
          { user: mockPassenger, status: PassengerStatus.Approved },
          { user: new Types.ObjectId(), status: PassengerStatus.Pending },
        ],
        save: jest.fn().mockResolvedValue(true),
        // Adiciona um método 'find' para simular a busca no subdocumento
        find: (predicate: any) => mockRideInstance.passengers.find(predicate),
      };
      mockedRideModel.findById.mockResolvedValue(mockRideInstance as any);

      // Act
      await rideService.cancelSeatByPassenger(
        mockRideInstance._id as any,
        mockPassenger,
      );

      // Assert
      expect(mockedRideModel.findById).toHaveBeenCalledWith(
        mockRideInstance._id,
      );

      // Verifica se o assento foi devolvido
      expect(mockRideInstance.availableSeats).toBe(3);

      // Verifica se o status do passageiro correto foi alterado
      const cancelledPassenger = mockRideInstance.find(
        (p: any) => p.user === mockPassenger,
      );
      expect(cancelledPassenger!.status).toBe(PassengerStatus.Cancelled);

      expect(mockRideInstance.save).toHaveBeenCalledTimes(1);
    });

    it("should cancel a pending seat without incrementing available seats", async () => {
      // Arrange
      const mockRideInstance = {
        ...mockRide,
        availableSeats: 2,
        passengers: [{ user: mockPassenger, status: PassengerStatus.Pending }],
        save: jest.fn().mockResolvedValue(true),
        find: (predicate: any) => mockRideInstance.passengers.find(predicate),
      };
      mockedRideModel.findById.mockResolvedValue(mockRideInstance as any);

      // Act
      await rideService.cancelSeatByPassenger(
        mockRideInstance._id as any,
        mockPassenger,
      );

      // Assert
      // O assento NÃO deve ser devolvido, pois o passageiro estava apenas pendente
      expect(mockRideInstance.availableSeats).toBe(2);
      const cancelledPassenger = mockRideInstance.find(
        (p: any) => p.user === mockPassenger,
      );
      expect(cancelledPassenger!.status).toBe(PassengerStatus.Cancelled);
      expect(mockRideInstance.save).toHaveBeenCalledTimes(1);
    });

    it("should throw an error if the ride is not found", async () => {
      // Arrange
      mockedRideModel.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(
        rideService.cancelSeatByPassenger(
          "non-existent-id" as any,
          mockPassenger,
        ),
      ).rejects.toThrow("Carona não encontrada.");
    });

    it("should throw an error if the passenger is not in the ride", async () => {
      // Arrange
      const mockRideInstance = {
        _id: new Types.ObjectId(),
        passengers: [], // Passageiro não está na lista
      };
      mockedRideModel.findById.mockResolvedValue(mockRideInstance as any);

      // Act & Assert
      await expect(
        rideService.cancelSeatByPassenger(
          mockRideInstance._id as any,
          mockPassenger,
        ),
      ).rejects.toThrow("Reserva não encontrada.");
    });
  });
});
