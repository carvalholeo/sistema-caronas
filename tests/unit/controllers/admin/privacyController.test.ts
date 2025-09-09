
import { Request, Response } from 'express';
import { adminPrivacyController } from '../../../../src/controllers/admin/privacyController';
import { adminPrivacyService } from '../../../../src/services/admin/privacyService';
import mongoose from 'mongoose';

// Mock dependencies
jest.mock('../../../src/services/admin/privacyService');

const mockedAdminPrivacyService = adminPrivacyService as jest.Mocked<typeof adminPrivacyService>;

describe('AdminPrivacyController', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: jest.Mock;
  let adminUser: any;
  let targetUserId: mongoose.Types.ObjectId;

  beforeEach(() => {
    jest.clearAllMocks();
    adminUser = { _id: new mongoose.Types.ObjectId(), roles: ['admin'] };
    targetUserId = new mongoose.Types.ObjectId();
    req = { user: adminUser, params: { targetUserId: targetUserId.toString() }, body: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  describe('generateDataReport', () => {
    it('should return report on success', async () => {
      const mockReport = { reportData: {}, hash: 'abc' };
      mockedAdminPrivacyService.generateDataReport.mockResolvedValue(mockReport);
      req.body = { twoFactorCode: '123456' };

      await adminPrivacyController.generateDataReport(req as Request, res as Response);

      expect(mockedAdminPrivacyService.generateDataReport).toHaveBeenCalledWith(
        targetUserId, adminUser, '123456'
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockReport);
    });

    it('should return 500 and error message on failure', async () => {
      const errorMessage = 'Service error';
      mockedAdminPrivacyService.generateDataReport.mockRejectedValue(new Error(errorMessage));
      req.body = { twoFactorCode: '123456' };

      await adminPrivacyController.generateDataReport(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Erro ao gerar relatório de dados.', error: errorMessage });
    });
  });

  describe('processRemovalRequest', () => {
    it('should return success message on successful processing', async () => {
      mockedAdminPrivacyService.processUserRemoval.mockResolvedValue({ message: 'Success' });
      req.body = { twoFactorCode: '123456' };

      await adminPrivacyController.processRemovalRequest(req as Request, res as Response);

      expect(mockedAdminPrivacyService.processUserRemoval).toHaveBeenCalledWith(
        targetUserId, adminUser, '123456'
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Solicitação de remoção processada com sucesso. O usuário foi anonimizado.' });
    });

    it('should return 500 and error message on failure', async () => {
      const errorMessage = 'Service error';
      mockedAdminPrivacyService.processUserRemoval.mockRejectedValue(new Error(errorMessage));
      req.body = { twoFactorCode: '123456' };

      await adminPrivacyController.processRemovalRequest(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Erro ao processar solicitação de remoção.', error: errorMessage });
    });
  });

  describe('viewPrivacyLogs', () => {
    it('should return privacy logs on success', async () => {
      const mockLogs = [{ log: 'entry' }];
      mockedAdminPrivacyService.viewPrivacyLogs.mockResolvedValue(mockLogs as any);

      await adminPrivacyController.viewPrivacyLogs(req as Request, res as Response);

      expect(mockedAdminPrivacyService.viewPrivacyLogs).toHaveBeenCalledWith(
        targetUserId, adminUser
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockLogs);
    });

    it('should return 500 and error message on failure', async () => {
      const errorMessage = 'Service error';
      mockedAdminPrivacyService.viewPrivacyLogs.mockRejectedValue(new Error(errorMessage));

      await adminPrivacyController.viewPrivacyLogs(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Erro ao visualizar logs de privacidade.', error: errorMessage });
    });
  });

  describe('sendFormalNotification', () => {
    it('should return success message on successful sending', async () => {
      mockedAdminPrivacyService.sendFormalNotification.mockResolvedValue({ message: 'Success' });
      req.body = { subject: 'Subject', body: 'Body' };

      await adminPrivacyController.sendFormalNotification(req as Request, res as Response);

      expect(mockedAdminPrivacyService.sendFormalNotification).toHaveBeenCalledWith(
        targetUserId, adminUser, 'Subject', 'Body'
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Notificação formal enviada com sucesso.' });
    });

    it('should return 500 and error message on failure', async () => {
      const errorMessage = 'Service error';
      mockedAdminPrivacyService.sendFormalNotification.mockRejectedValue(new Error(errorMessage));
      req.body = { subject: 'Subject', body: 'Body' };

      await adminPrivacyController.sendFormalNotification(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Erro ao enviar notificação formal.', error: errorMessage });
    });
  });
});
