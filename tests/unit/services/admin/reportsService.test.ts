import { adminReportsService } from "../../../../src/services/admin/reportsService";
import { UserModel } from "../../../../src/models/user";
import { AuditLogModel } from "../../../../src/models/auditLog";
import { RideModel } from "../../../../src/models/ride";
import { ChatMessageModel } from "../../../../src/models/chat";
import {
  NotificationEventModel,
  SearchEventModel,
} from "../../../../src/models/event";
import { RideViewEventModel } from "../../../../src/models/event";
import { VehicleModel } from "../../../../src/models/vehicle";
import { LoginAttemptModel } from "../../../../src/models/loginAttempt";
import { BlockModel } from "../../../../src/models/block";
import {
  UserStatus,
  AuditActionType,
  VehicleStatus,
} from "../../../../src/types/enums/enums";
import { PasswordResetModel } from "../../../../src/models/passwordReset";
import { NotificationSubscriptionModel } from "../../../../src/models/notificationSubscription";
import { DataReportModel } from "../../../../src/models/dataReport";
import { PrivacyRequestModel } from "../../../../src/models/privacyRequest";
import { SuppressedNotificationModel } from "../../../../src/models/suppressedNotification";

// Mock all models used in reportsService
jest.mock("../../../../src/models/user");
jest.mock("../../../../src/models/vehicle");
jest.mock("../../../../src/models/ride");
jest.mock("../../../../src/models/chat");
jest.mock("../../../../src/models/event", () => ({
  __esModule: true, // Importante se você estiver usando módulos ES
  SearchEventModel: {
    countDocuments: jest.fn(),
    aggregate: jest.fn(), // <-- Adicionado
  },
  RideViewEventModel: {
    countDocuments: jest.fn(),
  },
  NotificationEventModel: {
    countDocuments: jest.fn(), // <-- Adicionado
    aggregate: jest.fn(), // <-- Adicionado
  },
}));
jest.mock("../../../../src/models/loginAttempt");
jest.mock("../../../../src/models/passwordReset");
jest.mock("../../../../src/models/auditLog");
jest.mock("../../../../src/models/privacyRequest");
jest.mock("../../../../src/models/dataReport");
jest.mock("../../../../src/models/block");
jest.mock("../../../../src/models/notificationSubscription");
jest.mock("../../../../src/models/suppressedNotification");

const mockedUserModel = UserModel as jest.Mocked<typeof UserModel>;
const mockedAuditLogModel = AuditLogModel as jest.Mocked<typeof AuditLogModel>;
const mockedRideModel = RideModel as jest.Mocked<typeof RideModel>;
const mockedChatMessageModel = ChatMessageModel as jest.Mocked<
  typeof ChatMessageModel
>;
const mockedSearchEventModel = SearchEventModel as jest.Mocked<
  typeof SearchEventModel
>;
const mockedRideViewEventModel = RideViewEventModel as jest.Mocked<
  typeof RideViewEventModel
>;
const mockedVehicleModel = VehicleModel as jest.Mocked<typeof VehicleModel>;
const mockedLoginAttemptModel = LoginAttemptModel as jest.Mocked<
  typeof LoginAttemptModel
>;
const mockedPasswordResetModel = PasswordResetModel as jest.Mocked<
  typeof PasswordResetModel
>;
const mockedBlockModel = BlockModel as jest.Mocked<typeof BlockModel>;
const mockedNotificationEventModel = NotificationEventModel as jest.Mocked<
  typeof NotificationEventModel
>;
const mockedNotificationSubscriptionModel =
  NotificationSubscriptionModel as jest.Mocked<
    typeof NotificationSubscriptionModel
  >;
const mockedDataReportModel = DataReportModel as jest.Mocked<
  typeof DataReportModel
>;
const mockedPrivacyRequestModel = PrivacyRequestModel as jest.Mocked<
  typeof PrivacyRequestModel
>;
const mockedSuppressedNotificationModel =
  SuppressedNotificationModel as jest.Mocked<
    typeof SuppressedNotificationModel
  >;

describe("AdminReportsService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getRegistrationReport", () => {
    const startDate = new Date("2023-01-01T00:00:00.000Z");
    const endDate = new Date("2023-01-31T23:59:59.999Z");

    it("should return zero counts when no registrations are found", async () => {
      mockedUserModel.aggregate.mockResolvedValue([]);

      const report = await adminReportsService.getRegistrationReport(
        startDate,
        endDate,
      );

      expect(report).toEqual({
        totalRegistrations: 0,
        approvalRate: 0,
        rejectionRate: 0,
        averageDecisionTimeHours: "0.00",
        pendingCount: 0,
      });
      expect(mockedUserModel.aggregate).toHaveBeenCalledTimes(1);
    });

    it("should correctly calculate registration metrics without decision logs", async () => {
      mockedUserModel.aggregate.mockResolvedValue([
        {
          _id: null,
          totalRegistrations: 10,
          approved: 5,
          rejected: 3,
          pending: 2,
          totalDecisionTime: 0,
          decidedCount: 0,
        },
      ]);

      const report = await adminReportsService.getRegistrationReport(
        startDate,
        endDate,
      );

      expect(report).toEqual({
        totalRegistrations: 10,
        approvalRate: 0.5,
        rejectionRate: 0.3,
        averageDecisionTimeHours: "0.00",
        pendingCount: 2,
      });
    });

    it("should correctly calculate registration metrics with decision logs", async () => {
      const user1CreatedAt = new Date("2023-01-05T10:00:00.000Z");
      const user1DecisionAt = new Date("2023-01-05T11:00:00.000Z"); // 1 hour later
      const user2CreatedAt = new Date("2023-01-10T10:00:00.000Z");
      const user2DecisionAt = new Date("2023-01-10T12:00:00.000Z"); // 2 hours later

      mockedUserModel.aggregate.mockResolvedValue([
        {
          _id: null,
          totalRegistrations: 3,
          approved: 2,
          rejected: 1,
          pending: 0,
          totalDecisionTime:
            user1DecisionAt.getTime() -
            user1CreatedAt.getTime() +
            (user2DecisionAt.getTime() - user2CreatedAt.getTime()),
          decidedCount: 2,
        },
      ]);

      const report = await adminReportsService.getRegistrationReport(
        startDate,
        endDate,
      );

      // Total decision time: 1 hour (3600000ms) + 2 hours (7200000ms) = 10800000ms
      // Average decision time: 10800000ms / 2 = 5400000ms
      // 5400000ms / (1000 * 60 * 60) = 1.5 hours
      expect(report).toEqual({
        totalRegistrations: 3,
        approvalRate: 2 / 3,
        rejectionRate: 1 / 3,
        averageDecisionTimeHours: "1.50",
        pendingCount: 0,
      });
    });

    it("should pass correct aggregation pipeline to UserModel.aggregate", async () => {
      mockedUserModel.aggregate.mockResolvedValue([]);
      await adminReportsService.getRegistrationReport(startDate, endDate);

      const expectedPipeline = [
        { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
        {
          $lookup: {
            from: "AuditLog",
            let: { userId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$target.resourceId", "$$userId"] },
                      { $eq: ["$target.resourceType", "User"] },
                      {
                        $in: [
                          "$action.actionType",
                          [
                            AuditActionType.USER_APPROVED_BY_ADMIN,
                            AuditActionType.USER_REJECTED_BY_ADMIN,
                          ],
                        ],
                      },
                    ],
                  },
                },
              },
              { $sort: { createdAt: 1 } },
              { $limit: 1 },
            ],
            as: "decisionLog",
          },
        },
        {
          $addFields: {
            decisionEntry: { $arrayElemAt: ["$decisionLog", 0] },
          },
        },
        {
          $group: {
            _id: null,
            totalRegistrations: { $sum: 1 },
            approved: {
              $sum: {
                $cond: [{ $eq: ["$status", UserStatus.Approved] }, 1, 0],
              },
            },
            rejected: {
              $sum: {
                $cond: [{ $eq: ["$status", UserStatus.Rejected] }, 1, 0],
              },
            },
            pending: {
              $sum: { $cond: [{ $eq: ["$status", UserStatus.Pending] }, 1, 0] },
            },
            totalDecisionTime: {
              $sum: {
                $cond: [
                  "$decisionEntry",
                  { $subtract: ["$decisionEntry.createdAt", "$createdAt"] },
                  0,
                ],
              },
            },
            decidedCount: { $sum: { $cond: ["$decisionEntry", 1, 0] } },
          },
        },
      ];
      expect(mockedUserModel.aggregate).toHaveBeenCalledWith(expectedPipeline);
    });
  });

  // --- ADIÇÃO DE NOVOS TESTES ---

  describe("getEngagementReport", () => {
    const startDate = new Date("2023-01-01T00:00:00.000Z");
    const endDate = new Date("2023-01-31T23:59:59.999Z");
    it("should return MAU, DAU, and their ratio", async () => {
      // Arrange
      // Simula a resposta para a contagem de MAU
      mockedUserModel.countDocuments.mockResolvedValueOnce(1000);
      // Simula a resposta para a contagem de DAU
      mockedUserModel.countDocuments.mockResolvedValueOnce(150);

      // Act
      const report = await adminReportsService.getEngagementReport(endDate);

      // Assert
      expect(report).toEqual({
        mau: 1000,
        dau: 150,
        dauMauRatio: 0.15,
      });
      expect(mockedUserModel.countDocuments).toHaveBeenCalledTimes(2);
    });
  });

  describe("getRideOfferReport", () => {
    const startDate = new Date("2023-01-01T00:00:00.000Z");
    const endDate = new Date("2023-01-31T23:59:59.999Z");
    it("should correctly calculate ride offer metrics", async () => {
      // Arrange
      const mockRides = [
        {
          isRecurrent: true,
          availableSeats: 2,
          passengers: [{ status: "approved" }],
        }, // 3 assentos no total
        {
          isRecurrent: false,
          availableSeats: 3,
          passengers: [{ status: "approved" }, { status: "pending" }],
        }, // 4 assentos no total, 1 preenchido
      ];
      mockedRideModel.find.mockResolvedValue(mockRides as any);

      // Act
      const report = await adminReportsService.getRideOfferReport(
        startDate,
        endDate,
      );

      // Assert
      expect(report).toEqual({
        ridesPublished: 2,
        recurrentRideRatio: 0.5,
        totalCapacityOffered: 7, // 3 no primeiro + 4 no segundo
        averageOccupancyRate: 2 / 7, // 2 assentos preenchidos / 7 totais
      });
      expect(mockedRideModel.find).toHaveBeenCalledWith({
        createdAt: { $gte: startDate, $lte: endDate },
      });
    });
  });

  describe("getEsgReport", () => {
    const startDate = new Date("2023-01-01T00:00:00.000Z");
    const endDate = new Date("2023-01-31T23:59:59.999Z");
    it("should correctly calculate ESG metrics based on completed rides", async () => {
      // Arrange
      const mockAggResult = [
        {
          _id: null,
          totalSharedKm: 2500,
          totalPassengerEconomy: 1250,
          totalPassengerRides: 50,
          totalRides: 20,
        },
      ];
      mockedRideModel.aggregate.mockResolvedValue(mockAggResult);

      // Act
      const report = await adminReportsService.getEsgReport(startDate, endDate);

      // Assert
      // CO2 evitado: (2500 km * 130g/km) / 1000g/kg = 325 kg
      // Ocupação média: 50 passageiros / 20 caronas = 2.5
      // Economia média: R$1250 / 50 passageiros = R$25
      expect(report).toEqual({
        sharedKilometers: 2500,
        estimatedCo2EmissionsAvoidedKg: "325.00",
        averageOccupancyPerTrip: 2.5,
        averagePassengerSavings: 25,
      });
    });
  });

  describe("getSecurityReport", () => {
    const startDate = new Date("2023-01-01T00:00:00.000Z");
    const endDate = new Date("2023-01-31T23:59:59.999Z");
    it("should aggregate security-related metrics correctly", async () => {
      // Arrange
      const mockFailedLogins = [{ _id: "user@test.com", count: 5 }];
      const mock2FAUsage = [{ _id: "caroneiro", total: 10, with2FA: 3 }];

      // Mocks para cada chamada ao banco de dados dentro do método
      mockedLoginAttemptModel.aggregate.mockResolvedValue(mockFailedLogins);
      mockedUserModel.aggregate.mockResolvedValue(mock2FAUsage);
      mockedPasswordResetModel.countDocuments.mockResolvedValue(7);
      mockedAuditLogModel.countDocuments.mockResolvedValue(2);

      // Act
      const report = await adminReportsService.getSecurityReport(
        startDate,
        endDate,
      );

      // Assert
      expect(report).toEqual({
        topFailedLoginUsers: mockFailedLogins,
        twoFactorAdoption: mock2FAUsage,
        passwordResetsInitiated: 7,
        adminSessionRevocations: 2,
      });
    });
  });

  describe("getUserBlocksReport", () => {
    const startDate = new Date("2023-01-01T00:00:00.000Z");
    const endDate = new Date("2023-01-31T23:59:59.999Z");
    it("should return metrics about user blocks", async () => {
      // Arrange
      const mockTopReasons = [{ _id: "Comportamento inadequado", count: 10 }];
      mockedBlockModel.countDocuments.mockResolvedValueOnce(25); // totalBlocks
      mockedBlockModel.aggregate.mockResolvedValue(mockTopReasons);
      mockedBlockModel.countDocuments.mockResolvedValueOnce(3); // adminReversals

      // Act
      const report = await adminReportsService.getUserBlocksReport(
        startDate,
        endDate,
      );

      // Assert
      expect(report).toEqual({
        blocksAppliedInPeriod: 25,
        topBlockReasons: mockTopReasons,
        administrativeReversals: 3,
        impactOnBookings: "Not implemented",
      });
    });
  });

  describe("getVehicleInventoryReport", () => {
    const startDate = new Date("2023-01-01T00:00:00.000Z");
    const endDate = new Date("2023-01-31T23:59:59.999Z");
    it("should return vehicle inventory metrics", async () => {
      // Arrange
      const mockStatusCounts = [
        { _id: VehicleStatus.Active, count: 50 },
        { _id: VehicleStatus.Inactive, count: 10 },
        { _id: VehicleStatus.Pending, count: 5 },
      ];
      mockedVehicleModel.aggregate.mockResolvedValue(mockStatusCounts);
      mockedVehicleModel.countDocuments.mockResolvedValue(15); // newVehicles

      // Act
      const report = await adminReportsService.getVehicleInventoryReport(
        startDate,
        endDate,
      );

      // Assert
      expect(report).toEqual({
        activeVehicles: 50,
        inactiveVehicles: 10,
        newVehiclesInPeriod: 15,
        pendingAnalysis: 5,
      });
    });
  });

  describe("getRideAlterationReport", () => {
    const startDate = new Date("2023-01-01T00:00:00.000Z");
    const endDate = new Date("2023-01-31T23:59:59.999Z");
    it("should return ride cancellation and driver ranking metrics", async () => {
      // Arrange
      const mockCancellations = [{ critical: 1, shortNotice: 5, standard: 10 }];
      const mockDriverRanking = [
        { driverInfo: { name: "Motorista Teste" }, cancellationRate: 0.8 },
      ];

      mockedRideModel.aggregate
        .mockResolvedValueOnce(mockCancellations) // Para cancellationsByNotice
        .mockResolvedValueOnce(mockDriverRanking); // Para driverCancellationRanking

      // Act
      const report = await adminReportsService.getRideAlterationReport(
        startDate,
        endDate,
      );

      // Assert
      expect(report).toEqual({
        cancellationsByNotice: mockCancellations[0],
        driverCancellationRanking: mockDriverRanking,
      });
      expect(mockedRideModel.aggregate).toHaveBeenCalledTimes(2);
    });
  });

  describe("getRideBookingReport", () => {
    const startDate = new Date("2023-01-01T00:00:00.000Z");
    const endDate = new Date("2023-01-31T23:59:59.999Z");

    beforeEach(() => {
      jest.clearAllMocks();
      mockedSearchEventModel.countDocuments.mockResolvedValue(1000);
      mockedRideViewEventModel.countDocuments.mockResolvedValue(500);
      // Arrange
      const mockBookingAnalysis = [
        {
          _id: null,
          totalRequests: 100,
          approved: 80,
          totalResponseTime: 36000000, // 10 horas em ms
          managedCount: 90,
        },
      ];
      mockedRideModel.aggregate.mockResolvedValue(mockBookingAnalysis);
    });

    it("should return metrics about ride booking funnel", async () => {
      // Act
      const report = await adminReportsService.getRideBookingReport(
        startDate,
        endDate,
      );

      // Assert
      // Taxa de conversão: 80 aprovados / 1000 buscas = 0.08
      // Tempo médio de resposta: 10h / 90 respostas = 0.111... horas
      expect(report).toEqual({
        searches: 1000,
        views: 500,
        requests: 100,
        conversionRate: 0.08,
        averageDriverResponseTimeHours: "0.11",
      });
    });

    it("should handle cases with zero searches to avoid division by zero", async () => {
      // Arrange
      mockedSearchEventModel.countDocuments.mockResolvedValue(0); // Teste de caso de borda
      mockedRideViewEventModel.countDocuments.mockResolvedValue(10);
      const mockBookingAnalysis = [{ approved: 5 }];
      mockedRideModel.aggregate.mockResolvedValue(mockBookingAnalysis);

      // Act
      const report = await adminReportsService.getRideBookingReport(
        startDate,
        endDate,
      );

      // Assert
      expect(report.searches).toBe(0);
      expect(report.conversionRate).toBe(0); // Garante que não houve erro de divisão por zero.
    });
  });

  describe("getRideOccupancyReport", () => {
    const startDate = new Date("2023-01-01T00:00:00.000Z");
    const endDate = new Date("2023-01-31T23:59:59.999Z");
    it("should return zero for all metrics if no completed rides are found", async () => {
      // Arrange
      mockedRideModel.find.mockResolvedValue([]);
      // Act
      const report = await adminReportsService.getRideOccupancyReport(
        startDate,
        endDate,
      );
      // Assert
      expect(report).toEqual({ averagePassengers: 0, fullRidesRatio: 0 });
    });

    it("should correctly calculate occupancy metrics", async () => {
      // Arrange
      const mockRides = [
        {
          passengers: [{ status: "approved" }, { status: "approved" }],
          availableSeats: 0,
        }, // 2 passageiros, carona cheia
        { passengers: [{ status: "approved" }], availableSeats: 2 }, // 1 passageiro, não cheia
        { passengers: [{ status: "pending" }], availableSeats: 3 }, // 0 passageiros aprovados
        {
          passengers: [{ status: "approved" }, { status: "approved" }],
          availableSeats: 0,
        }, // 2 passageiros, carona cheia
      ];
      mockedRideModel.find.mockResolvedValue(mockRides as any);
      // Act
      const report = await adminReportsService.getRideOccupancyReport(
        startDate,
        endDate,
      );
      // Assert
      // Média: (2+1+0+2) / 4 = 1.25 passageiros
      // Caronas cheias: 2 / 4 = 0.5
      expect(report).toEqual({
        averagePassengers: 1.25,
        fullRidesRatio: 0.5,
        noShows: "Not implemented",
        preventedDuplicateBookings: "Not implemented",
      });
    });
  });

  describe("getGeoAdherenceReport", () => {
    const startDate = new Date("2023-01-01T00:00:00.000Z");
    const endDate = new Date("2023-01-31T23:59:59.999Z");
    it("should return heatmap points for morning and evening rides", async () => {
      // Arrange
      const mockMorningRide = {
        origin: { point: { coordinates: [1, 1] } },
        destination: { point: { coordinates: [2, 2] } },
        intermediateStops: [],
      };
      const mockEveningRide = {
        origin: { point: { coordinates: [3, 3] } },
        destination: { point: { coordinates: [4, 4] } },
        intermediateStops: [{ point: { coordinates: [5, 5] } }],
      };
      mockedRideModel.find = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue([mockMorningRide, mockEveningRide]),
      });

      // Act
      const report = await adminReportsService.getGeoAdherenceReport(
        startDate,
        endDate,
      );
      // Assert
      expect(report).toEqual({
        morningHeatmapPoints: [
          [1, 1],
          [2, 2],
          [3, 3],
          [4, 4],
          [5, 5],
        ],
        eveningHeatmapPoints: [
          [1, 1],
          [2, 2],
          [3, 3],
          [4, 4],
          [5, 5],
        ],
        averagePassengerDistanceToPickup: "Not implemented",
        averageDriverRouteDeviation: "Not implemented",
      });
    });
  });

  describe("getGeoPerformanceReport", () => {
    const startDate = new Date("2023-01-01T00:00:00.000Z");
    const endDate = new Date("2023-01-31T23:59:59.999Z");
    it("should return geo search performance metrics", async () => {
      // Arrange
      const mockPerformance = [
        {
          _id: null,
          totalSearches: 100,
          totalDuration: 50000, // 50s em ms
          noMatchSearches: 15,
        },
      ];
      mockedSearchEventModel.aggregate.mockResolvedValue(mockPerformance);
      // Act
      const report = await adminReportsService.getGeoPerformanceReport(
        startDate,
        endDate,
      );
      // Assert
      // Tempo médio: 50000ms / 100 = 500ms
      // Taxa sem resultado: 15 / 100 = 0.15
      expect(report).toEqual({
        averageSearchTimeMs: 500,
        noMatchRate: 0.15,
        matchQuality: "Not implemented (requires impression tracking)",
      });
    });
  });

  describe("getChatUsageReport", () => {
    const startDate = new Date("2023-01-01T00:00:00.000Z");
    const endDate = new Date("2023-01-31T23:59:59.999Z");
    it("should calculate chat usage metrics correctly", async () => {
      // Arrange
      const mockMessages = new Array(50).fill({}); // Simula 50 mensagens
      const mockConversations = [{ _id: "ride1" }, { _id: "ride2" }]; // Simula 2 conversas distintas
      mockedChatMessageModel.find.mockResolvedValue(mockMessages as any);
      mockedChatMessageModel.aggregate.mockResolvedValue(mockConversations);
      // Act
      const report = await adminReportsService.getChatUsageReport(
        startDate,
        endDate,
      );
      // Assert
      // Média: 50 mensagens / 2 conversas = 25
      expect(report).toEqual({
        messagesPerConversation: 25,
        messagesPerUser: "Not implemented",
        lateResponseConversations: "Not implemented",
      });
    });
  });

  describe("getChatAdminReport", () => {
    const startDate = new Date("2023-01-01T00:00:00.000Z");
    const endDate = new Date("2023-01-31T23:59:59.999Z");
    it("should return metrics on admin access to chats", async () => {
      // Arrange
      const mockReadsByAdmin = [{ adminName: "Admin User", count: 10 }];
      mockedAuditLogModel.countDocuments.mockResolvedValue(15);
      mockedAuditLogModel.aggregate.mockResolvedValue(mockReadsByAdmin);
      // Act
      const report = await adminReportsService.getChatAdminReport(
        startDate,
        endDate,
      );
      // Assert
      expect(report).toEqual({
        adminReadsInPeriod: 15,
        readsByAdmin: mockReadsByAdmin,
        repeatAccessOnSameChat: "Not implemented",
      });
    });
  });

  describe("getChatModerationReport", () => {
    const startDate = new Date("2023-01-01T00:00:00.000Z");
    const endDate = new Date("2023-01-31T23:59:59.999Z");
    it("should return metrics on chat moderation", async () => {
      // Arrange
      const mockReincidence = [{ userName: "Bad User", moderatedCount: 5 }];
      mockedChatMessageModel.countDocuments.mockResolvedValue(20);
      mockedChatMessageModel.aggregate.mockResolvedValue(mockReincidence);
      // Act
      const report = await adminReportsService.getChatModerationReport(
        startDate,
        endDate,
      );
      // Assert
      expect(report).toEqual({
        moderationActions: 20,
        escalatedCases: "Not implemented",
        userReincidence: mockReincidence,
      });
    });
  });

  describe("getNotificationDeliveryReport", () => {
    const startDate = new Date("2023-01-01T00:00:00.000Z");
    const endDate = new Date("2023-01-31T23:59:59.999Z");
    it("should return notification delivery and opt-in metrics", async () => {
      // Arrange
      const mockOptIn = [
        {
          totalUsersWithOptIn: 80,
          categoryRates: { rides: 0.9, chats: 0.8, communication: 0.7 },
        },
      ];
      const mockFunnel = [{ sent: 1000, delivered: 850, clicked: 100 }];
      mockedUserModel.countDocuments.mockResolvedValue(100); // totalActiveUsers
      mockedNotificationSubscriptionModel.aggregate.mockResolvedValue(
        mockOptIn,
      );
      mockedNotificationEventModel.aggregate.mockResolvedValue(mockFunnel);
      mockedNotificationSubscriptionModel.countDocuments.mockResolvedValue(10); // devicesWithoutPermission
      mockedNotificationEventModel.countDocuments.mockResolvedValue(50); // criticalDelivered
      // Act
      const report = await adminReportsService.getNotificationDeliveryReport(
        startDate,
        endDate,
      );
      // Assert
      expect(report).toEqual({
        optInRate: { general: 0.8, byCategory: mockOptIn[0].categoryRates },
        deliveryFunnel: mockFunnel[0],
        devicesWithoutPermission: 10,
        criticalNotificationsDelivered: 50,
      });
    });
  });

  describe("getNotificationLimitsReport", () => {
    const startDate = new Date("2023-01-01T00:00:00.000Z");
    const endDate = new Date("2023-01-31T23:59:59.999Z");
    it("should return metrics on notification suppression and failures", async () => {
      // Arrange
      const mockSuppressed = [
        { _id: "aggregation", count: 200 },
        { _id: "rate_limit", count: 50 },
      ];
      const mockFailures = [
        { _id: "web", count: 10 },
        { _id: "android", count: 5 },
      ];
      const mockDeliveryTime = [{ _id: null, totalTime: 15000, count: 100 }];
      mockedSuppressedNotificationModel.aggregate.mockResolvedValue(
        mockSuppressed,
      );
      mockedNotificationEventModel.aggregate
        .mockResolvedValueOnce(mockFailures)
        .mockResolvedValueOnce(mockDeliveryTime);
      // Act
      const report = await adminReportsService.getNotificationLimitsReport(
        startDate,
        endDate,
      );
      // Assert
      // Tempo médio: 15000ms / 100 = 150ms = 0.15s
      expect(report).toEqual({
        aggregationsApplied: 200,
        eventsSuppressedByLimit: 50,
        deliveryFailuresByPlatform: mockFailures,
        averageTimeToDeliverySeconds: "0.15",
      });
    });
  });

  describe("getAccessibilityReport", () => {
    it("should calculate accessibility settings adoption rates", async () => {
      // Arrange
      const mockAdoption = [
        {
          _id: null,
          totalUsers: 100,
          highContrast: 10,
          largeFont: 20,
          reduceAnimations: 5,
          muteSounds: 15,
        },
      ];
      mockedUserModel.aggregate.mockResolvedValue(mockAdoption);
      // Act
      const report = await adminReportsService.getAccessibilityReport();
      // Assert
      expect(report).toEqual({
        highContrastAdoption: 0.1,
        largeFontAdoption: 0.2,
        reduceAnimationsAdoption: 0.05,
        muteSoundsAdoption: 0.15,
      });
    });
  });

  describe("getLocalizationReport", () => {
    it("should return user language distribution", async () => {
      // Arrange
      const mockDistribution = [
        { _id: "pt-BR", count: 80 },
        { _id: "en-US", count: 20 },
      ];
      mockedUserModel.aggregate.mockResolvedValue(mockDistribution);
      // Act
      const report = await adminReportsService.getLocalizationReport();
      // Assert
      expect(report).toEqual({
        languageDistribution: mockDistribution,
        translationFallbacks: "Not implemented",
        rtlLayoutErrors: "Not implemented",
      });
    });
  });

  describe("getComplianceReport", () => {
    const startDate = new Date("2023-01-01T00:00:00.000Z");
    const endDate = new Date("2023-01-31T23:59:59.999Z");
    it("should return compliance and security metrics", async () => {
      // Arrange
      mockedAuditLogModel.countDocuments
        .mockResolvedValueOnce(50) // sensitiveLogs
        .mockResolvedValueOnce(100); // accessDenied
      // Act
      const report = await adminReportsService.getComplianceReport(
        startDate,
        endDate,
      );
      // Assert
      expect(report).toEqual({
        sensitiveLogsVolume: 50,
        deniedAccessAttempts: 100,
      });
    });
  });

  describe("getPrivacyComplianceReport", () => {
    const startDate = new Date("2023-01-01T00:00:00.000Z");
    const endDate = new Date("2023-01-31T23:59:59.999Z");
    it("should return privacy-related metrics", async () => {
      // Arrange
      const mockRequests = [
        { _id: "data_export", count: 5 },
        { _id: "deletion", count: 2 },
      ];
      mockedPrivacyRequestModel.aggregate.mockResolvedValue(mockRequests);
      mockedDataReportModel.countDocuments.mockResolvedValue(5);
      mockedUserModel.countDocuments.mockResolvedValue(2);
      // Act
      const report = await adminReportsService.getPrivacyComplianceReport(
        startDate,
        endDate,
      );
      // Assert
      expect(report).toEqual({
        requestsByType: mockRequests,
        softDeletesExecuted: 2,
        integrityReportsIssued: 5,
      });
    });
  });

  describe("getSessionSecurityReport", () => {
    const startDate = new Date("2023-01-01T00:00:00.000Z");
    const endDate = new Date("2023-01-31T23:59:59.999Z");
    it("should return metrics about session security", async () => {
      // Arrange
      mockedAuditLogModel.countDocuments.mockResolvedValue(3);
      // Act
      const report = await adminReportsService.getSessionSecurityReport(
        startDate,
        endDate,
      );
      // Assert
      expect(report).toEqual({
        globalLogouts: 3,
        refreshTokenRotations: "Not implemented",
        sessionsByDevice: "Not implemented",
      });
    });
  });
});
