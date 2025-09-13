// We must mock modules that have side-effects (notification providers, APNs, etc.)
// before importing the service under test to avoid runtime initialization.

// Mocking das dependências externas (call jest.mock before importing modules)
jest.mock('../../../src/models/user');
jest.mock('../../../src/models/loginAttempt');
jest.mock('../../../src/models/passwordReset');
jest.mock('../../../src/utils/security');
jest.mock('../../../src/services/notificationService', () => ({
  __esModule: true,
  default: {
    sendNotification: jest.fn(),
    subscribe: jest.fn(),
    updatePreferences: jest.fn()
  }
}));

jest.mock('../../../src/services/emailService', () => ({
  __esModule: true,
  emailService: {
    prepareEmailTemplate: jest.fn()
  }
}));
jest.mock('speakeasy');
jest.mock('crypto', () => ({
  randomBytes: jest.fn(() => Buffer.from('somerandomtoken')),
  createHash: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn().mockReturnValue('mockedhash')
  }))
}));

// We'll import the actual modules dynamically inside beforeEach so jest mocks are active.
let authServiceInstance: any;
let UserModel: any;
let LoginAttemptModel: any;
let PasswordResetModel: any;
let generateToken: any;
let notificationService: any;
let emailService: any;
let speakeasy: any;
let crypto: any;

let MockedUserModel: jest.MockedClass<any>;
let MockedLoginAttemptModel: jest.MockedClass<any>;
let MockedPasswordResetModel: jest.MockedClass<any>;
let mockedGenerateToken: jest.MockedFunction<any>;
let mockedNotificationService: jest.Mocked<any>;
let mockedEmailService: jest.Mocked<any>;
let mockedSpeakeasy: jest.Mocked<any>;
let mockedCrypto: jest.Mocked<any>;
import { UserRole, UserStatus, PasswordResetStatus } from '../../../src/types/enums/enums';
import { EmailTemplate } from '../../../src/types/enums/email';

// Mocking das dependências externas
// Note: dynamic imports below will initialize these variables before each test

describe('AuthService', () => {
  let authServiceInstance: any;

  // Dados de teste padronizados
  const mockUser = {
    _id: 'user123',
    email: 'test@example.com',
    matricula: '12345',
    name: 'Test User',
    password: 'hashedPassword',
    roles: [UserRole.Caroneiro],
    status: UserStatus.Approved,
    twoFactorSecret: null,
    sessionVersion: 1,
    permissions: ['read'],
    lastLogin: new Date(),
    comparePassword: jest.fn(),
    save: jest.fn()
  };

  const mockUserData = {
    email: 'test@example.com',
    matricula: '12345',
    password: 'plainPassword',
    name: 'Test User'
  };

  const mockCredentials = {
    email: 'test@example.com',
    password: 'plainPassword'
  };

  beforeEach(async () => {
    // Limpar todos os mocks antes de cada teste
    jest.clearAllMocks();

    // Resetar variáveis de ambiente
    process.env.FRONTEND_URL = 'http://localhost:3000';

    // Dynamically import modules after jest.mock calls so side-effectful
    // initialization (APNs, Firebase, etc.) is prevented by our mocks.
    const [
      authMod,
      userMod,
      loginAttemptMod,
      passwordResetMod,
      secMod,
      notificationMod,
      emailMod,
      speakeasyMod,
      cryptoMod
    ] = await Promise.all([
      import('../../../src/services/authService'),
      import('../../../src/models/user'),
      import('../../../src/models/loginAttempt'),
      import('../../../src/models/passwordReset'),
      import('../../../src/utils/security'),
      import('../../../src/services/notificationService'),
      import('../../../src/services/emailService'),
      import('speakeasy'),
      import('crypto')
    ]);

    authServiceInstance = authMod.authService;
    UserModel = userMod.UserModel;
    LoginAttemptModel = loginAttemptMod.LoginAttemptModel;
    PasswordResetModel = passwordResetMod.PasswordResetModel;
    generateToken = secMod.generateToken;
    notificationService = notificationMod.default || notificationMod;
    emailService = emailMod.emailService;
    speakeasy = speakeasyMod.default || speakeasyMod;
    crypto = cryptoMod.default || cryptoMod;

    MockedUserModel = UserModel as jest.MockedClass<any>;
    MockedLoginAttemptModel = LoginAttemptModel as jest.MockedClass<any>;
    MockedPasswordResetModel = PasswordResetModel as jest.MockedClass<any>;
    mockedGenerateToken = generateToken as jest.MockedFunction<any>;
    mockedNotificationService = notificationService as jest.Mocked<any>;
    mockedEmailService = emailService as jest.Mocked<any>;
    mockedSpeakeasy = speakeasy as jest.Mocked<any>;
    mockedCrypto = crypto as jest.Mocked<any>;
  });

  describe('register', () => {
    it('should successfully register a new user', async () => {
      // Arrange
      // MockedUserModel.findOne.mockResolvedValue(null);
      MockedUserModel.prototype.save = jest.fn().mockResolvedValue(mockUser);
      const mockUserInstance = { ...mockUser, save: jest.fn().mockResolvedValue(mockUser) };
      (MockedUserModel as any).mockImplementation(() => mockUserInstance);

      // Act
      const result = await authServiceInstance.register(mockUserData);

      // Assert
      expect(MockedUserModel.findOne).toHaveBeenCalledWith({
        $or: [{ email: mockUserData.email }, { matricula: mockUserData.matricula }]
      });
      expect(MockedUserModel).toHaveBeenCalledWith({
        email: mockUserData.email,
        matricula: mockUserData.matricula,
        password: mockUserData.password,
        name: mockUserData.name,
        roles: [UserRole.Caroneiro]
      });
      expect(result).toBeDefined();
    });

    it('should throw error when user with same email already exists', async () => {
      // Arrange
      (MockedUserModel.findOne as jest.Mock).mockResolvedValue(mockUser);

      // Act & Assert
      await expect(authServiceInstance.register(mockUserData))
        .rejects
        .toThrow('E-mail ou matrícula já cadastrado.');

      expect(MockedUserModel.findOne).toHaveBeenCalledWith({
        $or: [{ email: mockUserData.email }, { matricula: mockUserData.matricula }]
      });
    });

    it('should throw error when user with same matricula already exists', async () => {
      // Arrange
      const existingUserWithMatricula = { ...mockUser, email: 'different@example.com' };
      (MockedUserModel.findOne as jest.Mock).mockResolvedValue(existingUserWithMatricula);

      // Act & Assert
      await expect(authServiceInstance.register(mockUserData))
        .rejects
        .toThrow('E-mail ou matrícula já cadastrado.');
    });

    it('should handle registration with null/undefined values', async () => {
      // Arrange
      const invalidUserData = {
        email: null,
        matricula: undefined,
        password: '',
        name: ''
      };
      (MockedUserModel.findOne as jest.Mock).mockResolvedValue(null);
      const mockUserInstance = { save: jest.fn().mockResolvedValue(mockUser) };
      (MockedUserModel as any).mockImplementation(() => mockUserInstance);

      // Act
      const result = await authServiceInstance.register(invalidUserData);

      // Assert
      expect(MockedUserModel).toHaveBeenCalledWith({
        email: null,
        matricula: undefined,
        password: '',
        name: '',
        roles: [UserRole.Caroneiro]
      });
      expect(result).toBeDefined();
    });
  });

  describe('login', () => {
    const ipAddress = '192.168.1.1';
    const device = 'Chrome Browser';
    let mockLoginAttempt: any;

    beforeEach(() => {
      mockLoginAttempt = {
        email: mockCredentials.email,
        ipAddress,
        device,
        wasSuccessful: false,
        user: null,
        save: jest.fn()
      };
      (MockedLoginAttemptModel as any).mockImplementation(() => mockLoginAttempt);
    });

    it('should successfully login user without 2FA', async () => {
      // Arrange
      const userWithoutTwoFactor = { ...mockUser, twoFactorSecret: null };
      (MockedUserModel.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(userWithoutTwoFactor)
      } as any);
      userWithoutTwoFactor.comparePassword.mockResolvedValue(true);
      mockedGenerateToken.mockReturnValue('jwt-token');

      // Act
      const result = await authServiceInstance.login(mockCredentials, ipAddress, device);

      // Assert
      expect(MockedUserModel.findOne).toHaveBeenCalledWith({ email: mockCredentials.email });
      expect(userWithoutTwoFactor.comparePassword).toHaveBeenCalledWith(mockCredentials.password);
      expect(mockLoginAttempt.wasSuccessful).toBe(true);
      expect(mockLoginAttempt.save).toHaveBeenCalled();
      expect(userWithoutTwoFactor.save).toHaveBeenCalled();
      expect(mockedGenerateToken).toHaveBeenCalledWith(
        { id: userWithoutTwoFactor._id, permissions: userWithoutTwoFactor.permissions, sessionVersion: userWithoutTwoFactor.sessionVersion },
        expect.any(String)
      );
      expect(result).toEqual({
        token: 'jwt-token',
        user: {
          id: userWithoutTwoFactor._id,
          name: userWithoutTwoFactor.name,
          email: userWithoutTwoFactor.email,
          roles: userWithoutTwoFactor.roles
        }
      });
    });

    it('should return 2FA requirement when user has twoFactorSecret', async () => {
      // Arrange
      const userWithTwoFactor = { ...mockUser, twoFactorSecret: 'secret123' };
      (MockedUserModel.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(userWithTwoFactor)
      } as any);
      userWithTwoFactor.comparePassword.mockResolvedValue(true);
      mockedGenerateToken.mockReturnValue('temp-jwt-token');

      // Act
      const result = await authServiceInstance.login(mockCredentials, ipAddress, device);

      // Assert
      expect(result).toEqual({
        twoFactorRequired: true,
        tempToken: 'temp-jwt-token'
      });
      expect(mockedGenerateToken).toHaveBeenCalledWith(
        { id: userWithTwoFactor._id, twoFactorRequired: true },
        expect.any(String)
      );
    });

    it('should throw error when user does not exist', async () => {
      // Arrange
      (MockedUserModel.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(null)
      } as any);

      // Act & Assert
      await expect(authServiceInstance.login(mockCredentials, ipAddress, device))
        .rejects
        .toThrow('Credenciais inválidas.');

      expect(mockLoginAttempt.wasSuccessful).toBe(false);
      expect(mockLoginAttempt.save).toHaveBeenCalled();
    });

    it('should throw error when password is incorrect', async () => {
      // Arrange
      (MockedUserModel.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      } as any);
      mockUser.comparePassword.mockResolvedValue(false);

      // Act & Assert
      await expect(authServiceInstance.login(mockCredentials, ipAddress, device))
        .rejects
        .toThrow('Credenciais inválidas.');

      expect(mockLoginAttempt.wasSuccessful).toBe(false);
      expect(mockLoginAttempt.save).toHaveBeenCalled();
    });

    it('should throw error when user status is not approved', async () => {
      // Arrange
      const unapprovedUser = { ...mockUser, status: UserStatus.Pending };
      (MockedUserModel.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(unapprovedUser)
      } as any);
      unapprovedUser.comparePassword.mockResolvedValue(true);

      // Act & Assert
      await expect(authServiceInstance.login(mockCredentials, ipAddress, device))
        .rejects
        .toThrow(`Acesso negado. Status da conta: ${UserStatus.Pending}`);
    });

    it('should handle login attempt with undefined IP address', async () => {
      // Arrange
      (MockedUserModel.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      } as any);
      mockUser.comparePassword.mockResolvedValue(true);
      mockedGenerateToken.mockReturnValue('jwt-token');

      // Act
      await authServiceInstance.login(mockCredentials, undefined, device);

      // Assert
      expect(MockedLoginAttemptModel).toHaveBeenCalledWith({
        email: mockCredentials.email,
        ipAddress: undefined,
        device,
        wasSuccessful: false
      });
    });
  });

  describe('generateTwoFactorSecret', () => {
    it('should generate two factor secret successfully', () => {
      // Arrange
      const mockSecret = {
        base32: 'JBSWY3DPEHPK3PXP',
        otpauth_url: 'otpauth://totp/Carona%20Legal?secret=JBSWY3DPEHPK3PXP'
      };
      mockedSpeakeasy.generateSecret.mockReturnValue(mockSecret as any);

      // Act
      const result = authServiceInstance.generateTwoFactorSecret();

      // Assert
      expect(mockedSpeakeasy.generateSecret).toHaveBeenCalledWith({
        length: 20,
        name: 'Carona Legal'
      });
      expect(result).toEqual({
        secret: mockSecret.base32,
        otpauth_url: mockSecret.otpauth_url
      });
    });

    it('should handle speakeasy generateSecret returning undefined otpauth_url', () => {
      // Arrange
      const mockSecret = {
        base32: 'JBSWY3DPEHPK3PXP',
        otpauth_url: undefined
      };
      mockedSpeakeasy.generateSecret.mockReturnValue(mockSecret as any);

      // Act
      const result = authServiceInstance.generateTwoFactorSecret();

      // Assert
      expect(result.otpauth_url).toBeUndefined();
    });
  });

  describe('verifyTwoFactorCode', () => {
    it('should verify two factor code successfully', () => {
      // Arrange
      const secret = 'JBSWY3DPEHPK3PXP';
      const code = '123456';
      ((mockedSpeakeasy.totp.verify) as unknown as jest.Mock).mockReturnValue(true);

      // Act
      const result = authServiceInstance.verifyTwoFactorCode(secret, code);

      // Assert
      expect(mockedSpeakeasy.totp.verify).toHaveBeenCalledWith({
        secret,
        encoding: 'base32',
        token: code,
        window: 1
      });
      expect(result).toBe(true);
    });

    it('should return false for invalid two factor code', () => {
      // Arrange
      ((mockedSpeakeasy.totp.verify) as unknown as jest.Mock).mockReturnValue(false);

      // Act
      const result = authServiceInstance.verifyTwoFactorCode('secret', '000000');

      // Assert
      expect(result).toBe(false);
    });

    it('should handle empty secret and code', () => {
      // Arrange
      ((mockedSpeakeasy.totp.verify) as unknown as jest.Mock).mockReturnValue(false);

      // Act
      const result = authServiceInstance.verifyTwoFactorCode('', '');

      // Assert
      expect(mockedSpeakeasy.totp.verify).toHaveBeenCalledWith({
        secret: '',
        encoding: 'base32',
        token: '',
        window: 1
      });
      expect(result).toBe(false);
    });
  });

  describe('initiateReset', () => {
    const testEmail = 'test@example.com';

    beforeEach(() => {
      // Mock crypto functions
      mockedCrypto.randomBytes.mockReturnValue(Buffer.from('somerandomtoken'));
      mockedCrypto.createHash.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('hashedtoken')
      } as any);

      // Mock PasswordResetModel
      const mockPasswordReset = { save: jest.fn().mockResolvedValue({}) };
      (MockedPasswordResetModel as any).mockImplementation(() => mockPasswordReset);
    });

    it('should initiate password reset for approved user', async () => {
      // Arrange
      const approvedUser = { ...mockUser, status: 'approved' };
      (MockedUserModel.findOne as jest.Mock).mockResolvedValue(approvedUser);
      mockedEmailService.prepareEmailTemplate.mockResolvedValue('Reset email body');

      // Act
      await authServiceInstance.initiateReset(testEmail);

      // Assert
      expect(MockedUserModel.findOne).toHaveBeenCalledWith({ email: testEmail });
      expect(mockedCrypto.randomBytes).toHaveBeenCalledWith(32);
      expect(mockedCrypto.createHash).toHaveBeenCalledWith('sha256');
      expect(MockedPasswordResetModel).toHaveBeenCalledWith({
        user: approvedUser._id,
        tokenHash: 'hashedtoken',
        expiresAt: expect.any(Date)
      });
      expect(mockedEmailService.prepareEmailTemplate).toHaveBeenCalledWith(
        EmailTemplate.PasswordResetRequest,
        {
          userName: approvedUser.name,
          resetLink: expect.stringContaining('reset-password?token=')
        }
      );
      expect(mockedNotificationService.sendNotification).toHaveBeenCalled();
    });

    it('should not initiate reset for non-existent user', async () => {
      // Arrange
      (MockedUserModel.findOne as jest.Mock).mockResolvedValue(null);

      // Act
      await authServiceInstance.initiateReset(testEmail);

      // Assert
      expect(MockedUserModel.findOne).toHaveBeenCalledWith({ email: testEmail });
      expect(mockedCrypto.randomBytes).not.toHaveBeenCalled();
      expect(MockedPasswordResetModel).not.toHaveBeenCalled();
      expect(mockedNotificationService.sendNotification).not.toHaveBeenCalled();
    });

    it('should not initiate reset for unapproved user', async () => {
      // Arrange
      const unapprovedUser = { ...mockUser, status: 'pending' };
      (MockedUserModel.findOne as jest.Mock).mockResolvedValue(unapprovedUser);

      // Act
      await authServiceInstance.initiateReset(testEmail);

      // Assert
      expect(MockedUserModel.findOne).toHaveBeenCalledWith({ email: testEmail });
      expect(mockedCrypto.randomBytes).not.toHaveBeenCalled();
      expect(MockedPasswordResetModel).not.toHaveBeenCalled();
      expect(mockedNotificationService.sendNotification).not.toHaveBeenCalled();
    });

    it('should handle email service failure gracefully', async () => {
      // Arrange
      const approvedUser = { ...mockUser, status: 'approved' };
      (MockedUserModel.findOne as jest.Mock).mockResolvedValue(approvedUser);
      mockedEmailService.prepareEmailTemplate.mockRejectedValue(new Error('Email service failed'));

      // Act & Assert
      await expect(authServiceInstance.initiateReset(testEmail))
        .rejects
        .toThrow('Email service failed');
    });

    it('should generate correct reset link with environment URL', async () => {
      // Arrange
      process.env.FRONTEND_URL = 'https://app.example.com';
      const approvedUser = { ...mockUser, status: 'approved' };
      (MockedUserModel.findOne as jest.Mock).mockResolvedValue(approvedUser);
      mockedEmailService.prepareEmailTemplate.mockResolvedValue('Reset email body');

      // Mock hex conversion: ensure crypto.randomBytes(...).toString('hex') yields 'hextoken'
      (mockedCrypto.randomBytes as jest.Mock).mockReturnValue({ toString: jest.fn().mockReturnValue('hextoken') });

      // Act
      await authServiceInstance.initiateReset(testEmail);

      // Assert
      expect(mockedEmailService.prepareEmailTemplate).toHaveBeenCalledWith(
        EmailTemplate.PasswordResetRequest,
        expect.objectContaining({
          resetLink: 'https://app.example.com/reset-password?token=hextoken'
        })
      );
    });
  });

  describe('completeReset', () => {
    const testToken = 'rawtoken';
    const newPassword = 'newPassword123';

    beforeEach(() => {
      mockedCrypto.createHash.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('hashedtoken')
      } as any);
    });

    it('should complete password reset successfully', async () => {
      // Arrange
      const mockResetRequest = {
        user: 'user123',
        status: PasswordResetStatus.INITIATED,
        save: jest.fn().mockResolvedValue({})
      };
      (MockedPasswordResetModel.findOne as jest.Mock).mockResolvedValue(mockResetRequest);

      const mockUserToUpdate = { ...mockUser, save: jest.fn().mockResolvedValue({}) };
      (MockedUserModel.findById as jest.Mock).mockResolvedValue(mockUserToUpdate);

      // Act
      await authServiceInstance.completeReset(testToken, newPassword);

      // Assert
      expect(mockedCrypto.createHash).toHaveBeenCalledWith('sha256');
      expect(MockedPasswordResetModel.findOne).toHaveBeenCalledWith({
        tokenHash: 'hashedtoken',
        status: PasswordResetStatus.INITIATED,
        expiresAt: { $gt: expect.any(Date) }
      });
      expect(MockedUserModel.findById).toHaveBeenCalledWith(mockResetRequest.user);
      expect(mockUserToUpdate.password).toBe(newPassword);
      expect(mockUserToUpdate.save).toHaveBeenCalled();
      expect(mockResetRequest.status).toBe(PasswordResetStatus.COMPLETED);
      expect(mockResetRequest.save).toHaveBeenCalled();
    });

    it('should throw error for invalid or expired token', async () => {
      // Arrange
      (MockedPasswordResetModel.findOne as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(authServiceInstance.completeReset(testToken, newPassword))
        .rejects
        .toThrow('Token de redefinição inválido ou expirado.');

      expect(MockedPasswordResetModel.findOne).toHaveBeenCalledWith({
        tokenHash: 'hashedtoken',
        status: PasswordResetStatus.INITIATED,
        expiresAt: { $gt: expect.any(Date) }
      });
    });

    it('should throw error when user is not found', async () => {
      // Arrange
      const mockResetRequest = { user: 'nonexistentuser' };
      (MockedPasswordResetModel.findOne as jest.Mock).mockResolvedValue(mockResetRequest);
      (MockedUserModel.findById as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(authServiceInstance.completeReset(testToken, newPassword))
        .rejects
        .toThrow('Usuário não encontrado.');

      expect(MockedUserModel.findById).toHaveBeenCalledWith(mockResetRequest.user);
    });

    it('should handle already completed reset request', async () => {
      // Arrange
      (MockedPasswordResetModel.findOne as jest.Mock).mockResolvedValue(null); // Already completed requests won't be found

      // Act & Assert
      await expect(authServiceInstance.completeReset(testToken, newPassword))
        .rejects
        .toThrow('Token de redefinição inválido ou expirado.');
    });

    it('should handle empty token and password', async () => {
      // Arrange
      (MockedPasswordResetModel.findOne as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(authServiceInstance.completeReset('', ''))
        .rejects
        .toThrow('Token de redefinição inválido ou expirado.');
    });

    it('should handle user save failure', async () => {
      // Arrange
      const mockResetRequest = {
        user: 'user123',
        status: PasswordResetStatus.INITIATED,
        save: jest.fn().mockResolvedValue({})
      };
      (MockedPasswordResetModel.findOne as jest.Mock).mockResolvedValue(mockResetRequest);

      const mockUserToUpdate = {
        ...mockUser,
        save: jest.fn().mockRejectedValue(new Error('Database save failed'))
      };
      (MockedUserModel.findById as jest.Mock).mockResolvedValue(mockUserToUpdate);

      // Act & Assert
      await expect(authServiceInstance.completeReset(testToken, newPassword))
        .rejects
        .toThrow('Database save failed');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle database connection failures in register', async () => {
      // Arrange
      (MockedUserModel.findOne as jest.Mock).mockRejectedValue(new Error('Database connection failed'));

      // Act & Assert
      await expect(authServiceInstance.register(mockUserData))
        .rejects
        .toThrow('Database connection failed');
    });

    it('should handle database connection failures in login', async () => {
      // Arrange
      (MockedUserModel.findOne as jest.Mock).mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      // Act & Assert
      await expect(authServiceInstance.login(mockCredentials, '127.0.0.1', 'test-device'))
        .rejects
        .toThrow('Database connection failed');
    });

    it('should handle token generation failures', async () => {
      // Arrange
      (MockedUserModel.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      } as any);
      mockUser.comparePassword.mockResolvedValue(true);
      mockedGenerateToken.mockImplementation(() => {
        throw new Error('Token generation failed');
      });

      // Act & Assert
      await expect(authServiceInstance.login(mockCredentials, '127.0.0.1', 'test-device'))
        .rejects
        .toThrow('Token generation failed');
    });
  });
});
