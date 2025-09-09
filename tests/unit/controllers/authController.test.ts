
import { Request, Response } from 'express';
import { authController } from '../../../src/controllers/authController';
import { authService } from '../../../src/services/authService';
import qrcode from 'qrcode';
import * as security from '../../../src/utils/security';
import { UserModel } from '../../../src/models/user';
import mongoose from 'mongoose';

// Mock dependencies
jest.mock('../../../src/services/authService');
jest.mock('qrcode');
jest.mock('../../../src/utils/security');
jest.mock('../../../src/models/user');

const mockedAuthService = authService as jest.Mocked<typeof authService>;
const mockedQrcode = qrcode as jest.Mocked<typeof qrcode>;
const mockedSecurity = security as jest.Mocked<typeof security>;
const mockedUserModel = UserModel as jest.Mocked<typeof UserModel>;

describe('AuthController', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: jest.Mock;
  let mockUser: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { _id: new mongoose.Types.ObjectId(), email: 'test@user.com', twoFactorSecret: 'secret', save: jest.fn() };
    req = { user: mockUser, body: {}, ip: '127.0.0.1', headers: { 'user-agent': 'jest' } };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  describe('register', () => {
    it('should return 201 on successful registration', async () => {
      mockedAuthService.register.mockResolvedValue(mockUser);
      req.body = { email: 'new@user.com', password: 'pass' };

      await authController.register(req as Request, res as Response);

      expect(mockedAuthService.register).toHaveBeenCalledWith(req.body);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ message: "Cadastro realizado com sucesso. Aguardando aprovação." });
    });

    it('should return 409 on registration error', async () => {
      const errorMessage = 'E-mail ou matrícula já cadastrado.';
      mockedAuthService.register.mockRejectedValue(new Error(errorMessage));

      await authController.register(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({ message: errorMessage });
    });
  });

  describe('login', () => {
    it('should return 200 on successful login', async () => {
      const loginResult = { token: 'jwt', user: { id: 'user123' } };
      mockedAuthService.login.mockResolvedValue(loginResult);
      req.body = { email: 'test@user.com', password: 'pass' };

      await authController.login(req as Request, res as Response);

      expect(mockedAuthService.login).toHaveBeenCalledWith(req.body, req.ip, req.headers['user-agent']);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(loginResult);
    });

    it('should return 401 on login error', async () => {
      const errorMessage = 'Credenciais inválidas.';
      mockedAuthService.login.mockRejectedValue(new Error(errorMessage));

      await authController.login(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: errorMessage });
    });
  });

  describe('generate2FA', () => {
    it('should generate 2FA secret and QR code URL', async () => {
      const secretData = { secret: 'MOCKSECRET', otpauth_url: 'otpauth://mock' };
      mockedAuthService.generateTwoFactorSecret.mockReturnValue(secretData);
      mockedQrcode.toDataURL.mockImplementation((url, cb) => cb(null, 'data:image/png;base64,mockqr'));

      await authController.generate2FA(req as Request, res as Response);

      expect(mockedAuthService.generateTwoFactorSecret).toHaveBeenCalledTimes(1);
      expect(mockUser.twoFactorSecret).toBe(secretData.secret);
      expect(mockUser.save).toHaveBeenCalledTimes(1);
      expect(mockedQrcode.toDataURL).toHaveBeenCalledWith(secretData.otpauth_url, expect.any(Function));
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ secret: secretData.secret, qrCodeUrl: 'data:image/png;base64,mockqr' });
    });

    it('should return 500 on error', async () => {
      const errorMessage = 'Service error';
      mockedAuthService.generateTwoFactorSecret.mockImplementation(() => { throw new Error(errorMessage); });

      await authController.generate2FA(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Erro ao gerar segredo 2FA.', error: errorMessage });
    });
  });

  describe('verify2FA', () => {
    beforeEach(() => {
      req.body = { token: 'temp-token', code: '123456' };
      mockedSecurity.verifyToken.mockResolvedValue({ id: mockUser._id, twoFactorRequired: true });
      mockedUserModel.findById.mockResolvedValue(mockUser);
      mockedAuthService.verifyTwoFactorCode.mockReturnValue(true);
      mockedSecurity.generateToken.mockReturnValue('final-jwt');
    });

    it('should return 200 with new token on successful 2FA verification', async () => {
      await authController.verify2FA(req as Request, res as Response);

      expect(mockedSecurity.verifyToken).toHaveBeenCalledWith('temp-token');
      expect(mockedUserModel.findById).toHaveBeenCalledWith(mockUser._id.toString());
      expect(mockedAuthService.verifyTwoFactorCode).toHaveBeenCalledWith(mockUser.twoFactorSecret, '123456');
      expect(mockedSecurity.generateToken).toHaveBeenCalledWith(expect.any(Object), expect.any(String));
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ token: 'final-jwt' });
    });

    it('should return 401 if tempToken is invalid', async () => {
      mockedSecurity.verifyToken.mockRejectedValue(new Error('Invalid token'));
      await authController.verify2FA(req as Request, res as Response);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid token' });
    });

    it('should return 401 if tempToken is not for 2FA verification', async () => {
      mockedSecurity.verifyToken.mockResolvedValue({ id: mockUser._id, twoFactorRequired: false });
      await authController.verify2FA(req as Request, res as Response);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Token inválido para verificação 2FA.' });
    });

    it('should return 401 if user not found or 2FA not configured', async () => {
      mockedUserModel.findById.mockResolvedValue(null);
      await authController.verify2FA(req as Request, res as Response);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Usuário não encontrado ou 2FA não configurado.' });
    });

    it('should return 401 if 2FA code is invalid', async () => {
      mockedAuthService.verifyTwoFactorCode.mockReturnValue(false);
      await authController.verify2FA(req as Request, res as Response);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Código 2FA inválido.' });
    });
  });

  describe('requestReset', () => {
    it('should return 200 on successful request', async () => {
      mockedAuthService.initiateReset.mockResolvedValue(undefined);
      req.body = { email: 'reset@user.com' };

      await authController.requestReset(req as Request, res as Response);

      expect(mockedAuthService.initiateReset).toHaveBeenCalledWith(req.body.email);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Se um usuário com este e-mail existir, um link de redefinição de senha foi enviado.' });
    });

    it('should return 500 on error', async () => {
      const errorMessage = 'Service error';
      mockedAuthService.initiateReset.mockRejectedValue(new Error(errorMessage));

      await authController.requestReset(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Erro interno ao processar a solicitação.', error: errorMessage });
    });
  });

  describe('completeReset', () => {
    it('should return 200 on successful reset', async () => {
      mockedAuthService.completeReset.mockResolvedValue(undefined);
      req.body = { token: 'token', newPassword: 'newpass' };

      await authController.completeReset(req as Request, res as Response);

      expect(mockedAuthService.completeReset).toHaveBeenCalledWith(req.body.token, req.body.newPassword);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Senha redefinida com sucesso.' });
    });

    it('should return 400 on reset error', async () => {
      const errorMessage = 'Token inválido ou expirado.';
      mockedAuthService.completeReset.mockRejectedValue(new Error(errorMessage));

      await authController.completeReset(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: errorMessage });
    });
  });
});
