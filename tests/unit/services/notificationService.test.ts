import { NotificationService } from "../../../src/services/notificationService";
import { NotificationSubscriptionModel } from "../../../src/models/notificationSubscription";
import { NotificationEventModel } from "../../../src/models/event";
import { WebPushProvider } from "../../../src/providers/notifications/WebPushProvider";
import {
  INotificationPayload,
  INotificationSubscription,
  IUser,
} from "../../../src/types";
import { shouldNotifyNow } from "../../../src/utils/quietHours";
import { Types } from "mongoose";
import { SuppressedNotificationModel } from "../../../src/models/suppressedNotification";

jest.mock("../../../src/providers/notifications/WebPushProvider");
jest.mock("../../../src/providers/notifications/AndroidProvider");
jest.mock("../../../src/providers/notifications/IosProvider");
jest.mock("../../../src/providers/notifications/EmailProvider");
jest.mock("../../../src/models/suppressedNotification");
jest.mock("../../../src/models/event");
jest.mock("../../../src/utils/quietHours", () => ({
  shouldNotifyNow: jest.fn(),
}));

const mockedNotificationSubscriptionModel =
  NotificationSubscriptionModel as jest.Mocked<
    typeof NotificationSubscriptionModel
  >;
const mockedShouldNotifyNow = shouldNotifyNow as jest.Mock;
const MockedWebPushProvider = WebPushProvider as jest.MockedClass<
  typeof WebPushProvider
>;

describe("NotificationService", () => {
  let service: NotificationService;

  beforeEach(() => {
    service = new NotificationService();
    jest.clearAllMocks();
  });

  describe("subscribe", () => {
    it("should throw an error if user ID or device identifier is missing", async () => {
      await expect(
        service.subscribe({
          user: undefined,
          deviceIdentifier: undefined,
          platform: "web",
        }),
      ).rejects.toThrow("User ID e Device Identifier são obrigatórios.");
    });

    it("should create or update a subscription", async () => {
      const userId = new Types.ObjectId();
      jest
        .spyOn(NotificationSubscriptionModel, "findOneAndUpdate")
        .mockResolvedValue({
          user: userId,
          deviceIdentifier: "test-device",
          platform: "web",
        });

      const user = { _id: userId } as unknown as IUser;

      const result = await service.subscribe({
        user,
        deviceIdentifier: "test-device",
        platform: "web",
      });

      expect(result).toEqual({
        user: user._id,
        deviceIdentifier: "test-device",
        platform: "web",
      });
      expect(
        NotificationSubscriptionModel.findOneAndUpdate,
      ).toHaveBeenCalledWith(
        { user: user, deviceIdentifier: "test-device" },
        {
          $set: {
            user: user,
            deviceIdentifier: "test-device",
            platform: "web",
          },
        },
        { new: true, upsert: true, runValidators: true },
      );
    });
  });

  describe("updatePreferences", () => {
    it("should throw an error if subscription is not found", async () => {
      jest
        .spyOn(NotificationSubscriptionModel, "findOne")
        .mockResolvedValue(null);

      await expect(
        service.updatePreferences(
          { _id: new Types.ObjectId() } as IUser,
          "test-device",
          { kinds: {} },
        ),
      ).rejects.toThrow(
        "Assinatura de notificação não encontrada para este dispositivo.",
      );
    });

    it("should update notification kinds", async () => {
      const userId = new Types.ObjectId();
      jest.spyOn(NotificationSubscriptionModel, "findOne").mockResolvedValue({
        user: userId,
        deviceIdentifier: "test-device",
        preferences: {},
        notificationsKinds: { chats: true, rides: true },
        save: jest.fn().mockResolvedValue(true),
      });

      await service.updatePreferences({ _id: userId } as IUser, "test-device", {
        kinds: { chats: true },
      });

      expect(NotificationSubscriptionModel.findOne).toHaveBeenCalledWith({
        user: userId,
        deviceIdentifier: "test-device",
      });
    });
  });

  describe("sendNotification", () => {
    it("should not send if no subscriptions are found for a user", async () => {
      jest.spyOn(NotificationSubscriptionModel, "find").mockResolvedValue([]);
      const userId = new Types.ObjectId();
      const user = { _id: userId } as unknown as IUser;
      await service.sendNotification([user], {
        title: "Test",
        body: "Test body",
      } as INotificationPayload);

      expect(NotificationSubscriptionModel.find).toHaveBeenCalledWith({
        user: userId,
      });
    });

    it("should send notifications to all valid subscriptions", async () => {
      const userId = new Types.ObjectId();
      // Adjust find mock to include valid preferences and notificationsKinds
      jest.spyOn(NotificationSubscriptionModel, "find").mockResolvedValue([
        {
          user: userId,
          deviceIdentifier: "test-device",
          platform: "web",
          isPermissionGranted: true,
          notificationsKinds: { security: true },
          preferences: {
            weekMask: 127,
            startMinute: 0,
            endMinute: 1440,
            timezone: "UTC",
          },
        },
      ]);

      // Mock shouldNotifyNow to always return true
      jest
        .spyOn(require("../../../src/utils/quietHours"), "shouldNotifyNow")
        .mockReturnValue(true);

      // Ensure sendSpy tracks calls correctly
      const sendSpy = jest
        .spyOn(WebPushProvider.prototype, "send")
        .mockResolvedValue(void 0);

      await service.sendNotification([{ _id: userId } as unknown as IUser], {
        title: "Test",
        body: "Test body",
        category: "security",
      } as INotificationPayload);

      expect(sendSpy).toHaveBeenCalled();
    });
  });

  describe("sendAndLogNotification", () => {
    it("should log event as delivered on successful send", async () => {
      jest
        .spyOn(NotificationEventModel.prototype, "save")
        .mockResolvedValue(true);
      const userId = new Types.ObjectId();
      const result = await (service as any).sendAndLogNotification(
        { user: userId, deviceIdentifier: "test-device", platform: "web" },
        { title: "Test", body: "Test body" },
      );

      expect(result).toBe(true);
      expect(NotificationEventModel.prototype.save).toHaveBeenCalled();
    });

    it("should log event as failed on send error", async () => {
      jest
        .spyOn(NotificationEventModel.prototype, "save")
        .mockResolvedValue(true);
      jest
        .spyOn(WebPushProvider.prototype, "send")
        .mockRejectedValue(new Error("Send failed"));

      const userId = new Types.ObjectId();

      const result = await (service as any).sendAndLogNotification(
        { user: userId, deviceIdentifier: "test-device", platform: "web" },
        { title: "Test", body: "Test body" },
      );

      expect(result).toBe(false);
      expect(NotificationEventModel.prototype.save).toHaveBeenCalled();
    });
  });

  describe("subscribe", () => {
    it("should throw an error if user ID or device identifier is missing", async () => {
      await expect(service.subscribe({})).rejects.toThrow(
        "User ID e Device Identifier são obrigatórios.",
      );
    });

    it("should create or update a subscription", async () => {
      // Arrange
      const mockSub = { _id: "sub123", platform: "web" };
      mockedNotificationSubscriptionModel.findOneAndUpdate.mockResolvedValue(
        mockSub as any,
      );
      const user = { _id: new Types.ObjectId() } as IUser;
      const subData = {
        user,
        deviceIdentifier: "device-abc",
        platform: "web",
      } as INotificationSubscription;

      // Act
      const result = await service.subscribe(subData);

      // Assert
      expect(
        mockedNotificationSubscriptionModel.findOneAndUpdate,
      ).toHaveBeenCalledWith(
        { user: subData.user, deviceIdentifier: subData.deviceIdentifier },
        { $set: subData },
        { new: true, upsert: true, runValidators: true },
      );
      expect(result).toEqual(mockSub);
    });
  });

  describe("updatePreferences", () => {
    const userId = new Types.ObjectId();
    const deviceIdentifier = "test-device";
    let mockSubscription: any;

    beforeEach(() => {
      // Cria um mock de uma instância de assinatura com métodos mockados
      mockSubscription = {
        _id: "sub-id",
        user: userId,
        deviceIdentifier,
        notificationsKinds: { security: true, rides: false, chats: false },
        preferences: {
          daysToMask: jest.fn().mockReturnValue(127), // Retorna "todos os dias"
          convertHourToDatabase: jest.fn(),
        },
        save: jest.fn().mockResolvedValue(true),
      };
      // O findOne agora retorna nossa instância mockada
      mockedNotificationSubscriptionModel.findOne.mockResolvedValue(
        mockSubscription,
      );
    });

    it("should throw an error if subscription is not found", async () => {
      // Arrange
      mockedNotificationSubscriptionModel.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.updatePreferences(
          { _id: userId } as IUser,
          deviceIdentifier,
          {},
        ),
      ).rejects.toThrow(
        "Assinatura de notificação não encontrada para este dispositivo.",
      );
    });

    it("should update only notification kinds", async () => {
      // Arrange
      const preferencesData = { kinds: { rides: true, chats: true } };

      // Act
      await service.updatePreferences(
        { _id: userId } as IUser,
        deviceIdentifier,
        preferencesData,
      );

      // Assert
      expect(mockSubscription.notificationsKinds.rides).toBe(true);
      expect(mockSubscription.notificationsKinds.chats).toBe(true);
      expect(mockSubscription.save).toHaveBeenCalledTimes(1);
    });

    it("should set preferences to undefined if quietHours is null", async () => {
      // Arrange
      const preferencesData = { quietHours: null };

      // Act
      await service.updatePreferences(
        { _id: userId } as IUser,
        deviceIdentifier,
        preferencesData,
      );

      // Assert
      expect(mockSubscription.preferences).toBeUndefined();
      expect(mockSubscription.save).toHaveBeenCalledTimes(1);
    });

    it("should update quiet hours preferences correctly", async () => {
      // Arrange
      const preferencesData = {
        quietHours: {
          startHour: 22,
          endHour: 8,
          weekDays: [0, 6], // Fim de semana
          timezone: "America/Sao_Paulo",
        },
      };
      mockSubscription.preferences.daysToMask.mockReturnValue(65); // Simula a máscara para Dom e Sab

      // Act
      await service.updatePreferences(
        { _id: userId } as IUser,
        deviceIdentifier,
        preferencesData,
      );

      // Assert
      // Verifica se os métodos internos do schema foram chamados com os dados corretos
      expect(mockSubscription.preferences.daysToMask).toHaveBeenCalledWith([
        0, 6,
      ]);
      expect(
        mockSubscription.preferences.convertHourToDatabase,
      ).toHaveBeenCalledWith({
        startMinute: 22,
        endMinute: 8,
        weekMask: 65,
        timezone: "America/Sao_Paulo",
      });
      expect(mockSubscription.save).toHaveBeenCalledTimes(1);
    });
  });

  describe("sendNotification", () => {
    const mockPayload = {
      title: "Test",
      body: "Body",
      category: "communication",
    } as INotificationPayload;

    it("should send a notification if shouldSend returns true", async () => {
      // Arrange
      const user = { _id: new Types.ObjectId() } as IUser;
      const mockSub = {
        _id: "sub123",
        platform: "web",
        isPermissionGranted: true,
        notificationsKinds: { rides: true }, // Garante que o usuário aceita notificações desta categoria
        preferences: {
          weekMask: 127,
          startMinute: 0,
          endMinute: 1439,
          timezone: "UTC",
        },
      };
      mockedNotificationSubscriptionModel.find.mockResolvedValue([
        mockSub,
      ] as any);

      // Força 'shouldSend' a retornar true (através do seu mock de dependência)
      mockedShouldNotifyNow.mockReturnValue(true);

      // Mocka o método privado para isolar o teste
      const sendAndLogSpy = jest
        .spyOn(service as any, "sendAndLogNotification")
        .mockResolvedValue(true);

      // Act
      await service.sendNotification([user], {
        ...mockPayload,
        category: "rides",
      });

      // Assert
      expect(sendAndLogSpy).toHaveBeenCalledWith(mockSub, expect.any(Object));
    });

    it("should suppress a notification if shouldSend returns false", async () => {
      // Arrange
      const user = { _id: new Types.ObjectId() } as IUser;
      const mockSub = {
        _id: "sub123",
        platform: "web",
        isPermissionGranted: true,
        notificationsKinds: { rides: true },
        preferences: {},
      };
      mockedNotificationSubscriptionModel.find.mockResolvedValue([
        mockSub,
      ] as any);

      // Força 'shouldSend' a retornar false
      mockedShouldNotifyNow.mockReturnValue(false);

      const sendAndLogSpy = jest.spyOn(
        service as any,
        "sendAndLogNotification",
      );
      const suppressedSaveSpy = jest.fn().mockResolvedValue(true);
      (SuppressedNotificationModel as any as jest.Mock).mockImplementation(
        () => ({
          save: suppressedSaveSpy,
        }),
      );

      // Act
      await service.sendNotification([user], {
        ...mockPayload,
        category: "rides",
      });

      // Assert
      expect(sendAndLogSpy).not.toHaveBeenCalled();
      expect(suppressedSaveSpy).toHaveBeenCalledTimes(1);
    });
  });
});
