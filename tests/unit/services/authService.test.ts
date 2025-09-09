
import { authService } from '../../../src/services/authService';
import { UserModel } from '../../../src/models/user';
import { LoginAttemptModel } from '../../../src/models/loginAttempt';
import { PasswordResetModel } from '../../../src/models/passwordReset';
import authConfig from '../../../src/config/auth';
import { generateToken } from '../../../src/utils/security';
import mongoose from 'mongoose';
import { UserRole, UserStatus } from '../../../src/types/enums/enums';

// Mock all dependencies
jest.mock('../../../src/models/user');
jest.mock('../../../src/models/loginAttempt');
jest.mock('../../../src/models/passwordReset');
jest.mock('../../../src/config/auth', () => ({
  __esModule: true,
  default: {
    jwtExpiration: '1h',
    jwt2FAExpiration: '5m',
    refreshTokenExpiration: '7d',
    saltRounds: 12,
  },
}));
jest.mock('../../../src/utils/security');
jest.mock('speakeasy');
jest.mock('crypto', () => ({
  __esModule: true,
  ...jest.requireActual('crypto'),
  randomBytes: jest.fn(),
  createHash: jest.fn(),
}));
jest.mock('../../../src/utils/logger');
jest.mock('../../../src/services/notificationService');
jest.mock('../../../src/services/emailService');

const mockedUserModel = UserModel as jest.Mocked<typeof UserModel>;
const mockedLoginAttemptModel = LoginAttemptModel as jest.Mocked<typeof LoginAttemptModel>;
const mockedPasswordResetModel = PasswordResetModel as jest.Mocked<typeof PasswordResetModel>;
const mockedGenerateToken = generateToken as jest.Mock;

describe('AuthService', () => {
  let mockUser: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockUser = {
      _id: new mongoose.Types.ObjectId(),
      email: 'test@example.com',
      matricula: 'TEST123',
      password: 'hashedpassword',
      roles: [UserRole.Caroneiro],
      status: UserStatus.Approved,
      sessionVersion: 1,
      twoFactorSecret: null,
      comparePassword: jest.fn().mockResolvedValue(true),
      save: jest.fn().mockResolvedValue(true),
    };

    // Mock model constructors and their save methods
    (mockedUserModel as jest.Mock).mockImplementation(() => mockUser);
    (mockedLoginAttemptModel as jest.Mock).mockImplementation(() => ({
      save: jest.fn().mockResolvedValue(true),
    }));
    (mockedPasswordResetModel as jest.Mock).mockImplementation(() => ({
      save: jest.fn().mockResolvedValue(true),
    }));

    mockedUserModel.findOne.mockResolvedValue(null);
    mockedUserModel.findById.mockResolvedValue(null);
  });

  describe('register', () => {
    it('should successfully register a new user', async () => {
      const userData = { email: 'new@example.com', matricula: 'NEW123', password: 'pass', name: 'New User' };
      mockedUserModel.findOne.mockResolvedValue(null);
      mockedUserModel.mockImplementationOnce(() => ({ ...mockUser, ...userData, save: jest.fn().mockResolvedValue(true) }));

      const result = await authService.register(userData);

      expect(mockedUserModel.findOne).toHaveBeenCalledWith({ $or: [{ email: userData.email }, { matricula: userData.matricula }] });
      expect(mockedUserModel).toHaveBeenCalledWith(expect.objectContaining({
        email: userData.email,
        matricula: userData.matricula,
        name: userData.name,
        roles: [UserRole.Caroneiro],
      }));
      expect(result.save).toHaveBeenCalledTimes(1);
      expect(result.email).toBe(userData.email);
    });

    it('should throw an error if user already exists', async () => {
      const userData = { email: 'existing@example.com', matricula: 'EXISTING', password: 'pass', name: 'Existing User' };
      mockedUserModel.findOne.mockResolvedValue(mockUser);

      await expect(authService.register(userData)).rejects.toThrow('E-mail ou matrícula já cadastrado.');
      expect(mockedUserModel.findOne).toHaveBeenCalledTimes(1);
      expect(mockedUserModel).not.toHaveBeenCalledWith(); // Constructor should not be called
    });
  });

  describe('login', () => {
    const credentials = { email: 'test@example.com', password: 'password123' };
    const ipAddress = '127.0.0.1';
    const device = 'jest-device';

    it('should throw error and log failed attempt if user not found', async () => {
      mockedUserModel.findOne.mockResolvedValue(null);

      await expect(authService.login(credentials, ipAddress, device)).rejects.toThrow('Credenciais inválidas.');
      const loginAttemptInstance = (mockedLoginAttemptModel as jest.Mock).mock.results[0].value;
      expect(loginAttemptInstance.save).toHaveBeenCalledTimes(1);
      expect(loginAttemptInstance.wasSuccessful).toBe(false);
    });

    it('should throw error and log failed attempt if password does not match', async () => {
      mockedUserModel.findOne.mockResolvedValue(mockUser);
      mockUser.comparePassword.mockResolvedValue(false);

      await expect(authService.login(credentials, ipAddress, device)).rejects.toThrow('Credenciais inválidas.');
      const loginAttemptInstance = (mockedLoginAttemptModel as jest.Mock).mock.results[0].value;
      expect(loginAttemptInstance.save).toHaveBeenCalledTimes(1);
      expect(loginAttemptInstance.wasSuccessful).toBe(false);
    });

    it('should throw error if user status is not Approved', async () => {
      mockUser.status = UserStatus.Pending;
      mockedUserModel.findOne.mockResolvedValue(mockUser);

      await expect(authService.login(credentials, ipAddress, device)).rejects.toThrow(`Acesso negado. Status da conta: ${UserStatus.Pending}`);
      expect(mockUser.comparePassword).toHaveBeenCalledTimes(1);
      expect((mockedLoginAttemptModel as jest.Mock).mock.results[0].value.save).not.toHaveBeenCalled(); // No login attempt saved if status is not approved
    });

    it('should successfully log in a user without 2FA', async () => {
      mockedUserModel.findOne.mockResolvedValue(mockUser);
      mockedGenerateToken.mockReturnValue('mock-jwt-token');

      const result = await authService.login(credentials, ipAddress, device);

      const loginAttemptInstance = (mockedLoginAttemptModel as jest.Mock).mock.results[0].value;
      expect(loginAttemptInstance.wasSuccessful).toBe(true);
      expect(loginAttemptInstance.user).toEqual(mockUser._id);
      expect(loginAttemptInstance.save).toHaveBeenCalledTimes(1);
      expect(mockUser.lastLogin).toBeInstanceOf(Date);
      expect(mockUser.save).toHaveBeenCalledTimes(1);
      expect(mockedGenerateToken).toHaveBeenCalledWith(expect.objectContaining({ id: mockUser._id }), authConfig.jwtExpiration);
      expect(result).toEqual({ token: 'mock-jwt-token', user: { id: mockUser._id, name: mockUser.name, email: mockUser.email, roles: mockUser.roles } });
    });

    it('should return 2FA required if user has 2FA enabled', async () => {
      mockUser.twoFactorSecret = 'some-secret';
      mockedUserModel.findOne.mockResolvedValue(mockUser);
      mockedGenerateToken.mockReturnValue('mock-temp-token');

      const result = await authService.login(credentials, ipAddress, device);

      expect(mockedGenerateToken).toHaveBeenCalledWith(expect.objectContaining({ id: mockUser._id, twoFactorRequired: true }), authConfig.jwt2FAExpiration);
      expect(result).toEqual({ twoFactorRequired: true, tempToken: 'mock-temp-token' });
    });
  });
});
