import { adminUsersService } from "../../../../src/services/admin/userService";
import { UserModel } from "../../../../src/models/user";
import { AuthService, authService } from "../../../../src/services/authService";
import mongoose from "mongoose";
import { UserStatus, UserRole } from "../../../../src/types/enums/enums";

// Mock dependencies
jest.mock("../../../../src/models/user");
jest.mock("../../../../src/models/auditLog");
jest.mock("../../../../src/services/authService");

const mockedUserModel = UserModel as jest.Mocked<typeof UserModel>;
const mockedAuthService = authService as jest.Mocked<typeof authService>;

describe("AdminUsersService", () => {
  let adminUser: any;
  let targetUser: any;
  let authServiceInstance: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    adminUser = {
      _id: new mongoose.Types.ObjectId(),
      twoFactorSecret: "secret",
      roles: [UserRole.Admin],
      permissions: [
        "usuarios:aprovar",
        "usuarios:suspender",
        "usuarios:banir",
        "usuarios:remover_2fa",
      ],
    };
    targetUser = {
      _id: new mongoose.Types.ObjectId(),
      status: UserStatus.Pending,
      sessionVersion: 1,
      twoFactorEnabled: true,
      save: jest.fn(),
    };
  });

  describe("listUsers", () => {
    it("should return all users if no filters are provided", async () => {
      const mockUsers = [{ _id: "user1" }, { _id: "user2" }];
      mockedUserModel.find.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUsers),
      } as any);

      const result = await adminUsersService.listUsers({});

      expect(mockedUserModel.find).toHaveBeenCalledWith({});
      expect(result).toEqual(mockUsers);
    });

    it("should filter users by status", async () => {
      const mockUsers = [{ _id: "user1", status: UserStatus.Approved }];
      mockedUserModel.find.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUsers),
      } as any);

      const result = await adminUsersService.listUsers({
        status: UserStatus.Approved,
      });

      expect(mockedUserModel.find).toHaveBeenCalledWith({
        status: UserStatus.Approved,
      });
      expect(result).toEqual(mockUsers);
    });

    it("should filter users by role", async () => {
      const mockUsers = [{ _id: "user1", roles: [UserRole.Admin] }];
      mockedUserModel.find.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUsers),
      } as any);

      const result = await adminUsersService.listUsers({
        role: UserRole.Admin,
      });

      expect(mockedUserModel.find).toHaveBeenCalledWith({
        roles: UserRole.Admin,
      });
      expect(result).toEqual(mockUsers);
    });
  });

  describe("updateUserStatus", () => {
    it("should throw an error if target user is not found", async () => {
      mockedUserModel.findById.mockResolvedValue(null);
      await expect(
        adminUsersService.updateUserStatus(
          targetUser,
          adminUser,
          UserStatus.Approved,
        ),
      ).rejects.toThrow("Usuário alvo não encontrado.");
    });

    it("should throw an error for insufficient permission", async () => {
      mockedUserModel.findById.mockResolvedValue(targetUser);
      adminUser.permissions = []; // Remove permissions
      await expect(
        adminUsersService.updateUserStatus(
          targetUser,
          adminUser,
          UserStatus.Approved,
        ),
      ).rejects.toThrow(
        "Permissão insuficiente para alterar para este status.",
      );
    });

    it("should update status to Approved", async () => {
      mockedUserModel.findById.mockResolvedValue(targetUser);

      const result = await adminUsersService.updateUserStatus(
        targetUser,
        adminUser,
        UserStatus.Approved,
      );

      expect(result!.status).toBe(UserStatus.Approved);
      expect(result!.save).toHaveBeenCalledTimes(1);
    });

    it("should require reason and 2FA for Banned status", async () => {
      mockedUserModel.findById.mockResolvedValue(targetUser);
      await expect(
        adminUsersService.updateUserStatus(
          targetUser,
          adminUser,
          UserStatus.Banned,
          undefined,
          "123456",
        ),
      ).rejects.toThrow("Razão e código 2FA são obrigatórios para esta ação.");
      await expect(
        adminUsersService.updateUserStatus(
          targetUser,
          adminUser,
          UserStatus.Banned,
          "Reason",
          undefined,
        ),
      ).rejects.toThrow("Razão e código 2FA são obrigatórios para esta ação.");
    });

    it("should throw error for invalid 2FA for Banned status", async () => {
      mockedUserModel.findById.mockResolvedValue(targetUser);
      mockedAuthService.verifyTwoFactorCode.mockReturnValue(false);
      await expect(
        adminUsersService.updateUserStatus(
          targetUser,
          adminUser,
          UserStatus.Banned,
          "Reason",
          "invalid",
        ),
      ).rejects.toThrow("Código 2FA do administrador inválido.");
    });

    it("should update status to Banned and increment sessionVersion", async () => {
      mockedUserModel.findById.mockResolvedValue(targetUser);
      mockedAuthService.verifyTwoFactorCode.mockReturnValue(true);

      const result = await adminUsersService.updateUserStatus(
        targetUser,
        adminUser,
        UserStatus.Banned,
        "Reason",
        "123456",
      );

      expect(result!.status).toBe(UserStatus.Banned);
      expect(result!.sessionVersion).toBe(2); // Incremented
      expect(result!.save).toHaveBeenCalledTimes(1);
    });
  });
  describe("updateUser", () => {
    let updateData: any;

    beforeEach(() => {
      updateData = {
        name: "New Name",
        email: "new@email.com",
        reason: "Admin request",
        twoFactorCode: "123456",
      };
      // Configuração padrão de sucesso para o teste
      mockedUserModel.findById.mockResolvedValue(targetUser);
      adminUser.permissions.push("usuarios:editar");
    });

    it("should throw an error if user to update is not found", async () => {
      // Arrange
      mockedUserModel.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(
        adminUsersService.updateUser(targetUser._id, adminUser, updateData),
      ).rejects.toThrow("Usuário alvo não encontrado.");
    });

    it("should throw an error if admin lacks permission to edit", async () => {
      // Arrange
      adminUser.permissions = []; // Remove a permissão de edição

      // Act & Assert
      await expect(
        adminUsersService.updateUser(targetUser._id, adminUser, updateData),
      ).rejects.toThrow("Permissão insuficiente para editar usuário.");
    });

    it("should successfully update user name and email", async () => {
      // Act
      await adminUsersService.updateUser(targetUser._id, adminUser, updateData);

      // Assert
      expect(targetUser.name).toBe("New Name");
      expect(targetUser.email).toBe("new@email.com");
      expect(targetUser.sessionVersion).toBe(2); // sessionVersion deve ser incrementada
      expect(targetUser.save).toHaveBeenCalledTimes(1);
    });

    it("should successfully disable 2FA with correct permissions and 2FA code", async () => {
      // Arrange
      updateData = {
        disable2FA: true,
        reason: "User lost device",
        twoFactorCode: "123456",
      };
      mockedAuthService.verifyTwoFactorCode.mockReturnValue(true);

      // Act
      await adminUsersService.updateUser(targetUser._id, adminUser, updateData);

      // Assert
      expect(mockedAuthService.verifyTwoFactorCode).toHaveBeenCalledWith(
        adminUser.toString(),
        "123456",
      );
      expect(targetUser.twoFactorEnabled).toBe(false);
      expect(targetUser.sessionVersion).toBe(2);
      expect(targetUser.save).toHaveBeenCalledTimes(1);
    });
    it("should throw an error when trying to disable 2FA with invalid 2FA code", async () => {
      // Arrange
      updateData = {
        disable2FA: true,
        reason: "User lost device",
        twoFactorCode: "wrong-code",
      };
      mockedAuthService.verifyTwoFactorCode.mockReturnValue(false); // Simula código inválido

      // Act & Assert
      await expect(
        adminUsersService.updateUser(targetUser._id, adminUser, updateData),
      ).rejects.toThrow("Código 2FA do administrador inválido.");
      expect(targetUser.save).not.toHaveBeenCalled();
    });
  });

  describe("promoteToAdmin", () => {
    beforeEach(() => {
      targetUser.twoFactorEnabled = true;
      targetUser.twoFactorSecret = "user-secret";
      targetUser.roles = [UserRole.Caroneiro]; // Garante que não é admin ainda
      mockedUserModel.findById.mockResolvedValue(targetUser);
      mockedAuthService.verifyTwoFactorCode.mockReturnValue(true);
    });

    it("should throw an error if target user already is an admin", async () => {
      // Arrange
      targetUser.roles.push(UserRole.Admin); // Simula já ser admin

      // Act & Assert
      await expect(
        adminUsersService.promoteToAdmin(targetUser._id, adminUser, "123456"),
      ).rejects.toThrow("Usuário já é um administrador.");
    });

    it("should throw an error if target user does not have 2FA enabled", async () => {
      // Arrange
      targetUser.twoFactorEnabled = false;
      targetUser.twoFactorSecret = null;

      // Act & Assert
      await expect(
        adminUsersService.promoteToAdmin(targetUser._id, adminUser, "123456"),
      ).rejects.toThrow(
        "Promoção recusada. O usuário precisa ter o 2FA ativo antes de ser promovido.",
      );
    });

    it("should successfully promote a user to admin", async () => {
      // Act
      await adminUsersService.promoteToAdmin(
        targetUser._id,
        adminUser,
        "123456",
      );

      // Assert
      expect(targetUser.roles).toContain(UserRole.Admin);
      expect(targetUser.permissions).toEqual(["painel:acesso"]);
      expect(targetUser.sessionVersion).toBe(2);
      expect(targetUser.save).toHaveBeenCalledTimes(1);
    });
  });

  describe("demoteAdmin", () => {
    beforeEach(() => {
      targetUser.roles = [UserRole.Admin, UserRole.Caroneiro];
      mockedUserModel.findById.mockResolvedValue(targetUser);
      mockedAuthService.verifyTwoFactorCode.mockReturnValue(true);
    });

    it("should throw an error if target user is not an admin", async () => {
      // Arrange
      targetUser.roles = [UserRole.Caroneiro];

      // Act & Assert
      await expect(
        adminUsersService.demoteAdmin(
          targetUser._id,
          adminUser,
          "Reason",
          "123456",
        ),
      ).rejects.toThrow("Administrador alvo não encontrado.");
    });

    it("should successfully demote an admin to a regular user", async () => {
      // Act
      await adminUsersService.demoteAdmin(
        targetUser._id,
        adminUser,
        "Reason",
        "123456",
      );

      // Assert
      expect(targetUser.roles).not.toContain(UserRole.Admin);
      expect(targetUser.roles).toContain(UserRole.Caroneiro); // Mantém outros papéis
      expect(targetUser.permissions).toEqual([]);
      expect(targetUser.sessionVersion).toBe(2);
      expect(targetUser.save).toHaveBeenCalledTimes(1);
    });
  });

  describe("updateAdminPermissions", () => {
    const newPermissions = ["usuarios:ver", "caronas:gerenciar"];

    beforeEach(() => {
      targetUser.roles = [UserRole.Admin];
      targetUser.permissions = ["painel:acesso"];
      mockedUserModel.findById.mockResolvedValue(targetUser);
    });

    it("should throw an error if target user is not an admin", async () => {
      // Arrange
      targetUser.roles = [UserRole.Caroneiro];

      // Act & Assert
      await expect(
        adminUsersService.updateAdminPermissions(
          targetUser._id,
          adminUser,
          newPermissions,
        ),
      ).rejects.toThrow("Administrador alvo não encontrado.");
    });

    it("should successfully update admin permissions", async () => {
      // Act
      await adminUsersService.updateAdminPermissions(
        targetUser._id,
        adminUser,
        newPermissions,
      );

      // Assert
      expect(targetUser.permissions).toEqual(newPermissions);
      expect(targetUser.sessionVersion).toBe(2); // sessionVersion é incrementada na verdade
      expect(targetUser.save).toHaveBeenCalledTimes(1);
    });
  });

  describe("getAdminPermissions", () => {
    beforeEach(() => {
      targetUser.roles = [UserRole.Admin];
      targetUser.permissions = ["perm1", "perm2"];
      // Mock para query encadeada .select()
      mockedUserModel.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(targetUser),
      } as any);
    });

    it("should throw an error if user is not an admin", async () => {
      // Arrange
      targetUser.roles = [UserRole.Caroneiro];

      // Act & Assert
      await expect(
        adminUsersService.getAdminPermissions(targetUser._id),
      ).rejects.toThrow("Este usuário não é um administrador.");
    });

    it("should return the permissions of an admin user", async () => {
      // Act
      const result = await adminUsersService.getAdminPermissions(
        targetUser._id,
      );

      // Assert
      expect(mockedUserModel.findById).toHaveBeenCalledWith(targetUser._id);
      expect(result).toEqual({ permissions: ["perm1", "perm2"] });
    });
  });
});
