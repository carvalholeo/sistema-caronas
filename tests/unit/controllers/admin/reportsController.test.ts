
import { Request, Response } from 'express';
import { adminReportsController } from '../../../../src/controllers/admin/reportsController';
import { adminReportsService } from '../../../../src/services/admin/reportsService';

// Mock dependencies
jest.mock('../../../src/services/admin/reportsService');

const mockedAdminReportsService = adminReportsService as jest.Mocked<typeof adminReportsService>;

describe('AdminReportsController', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { query: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  // Test the private handleReportRequest helper method directly
  describe('handleReportRequest (private helper)', () => {
    let handleReportRequest: (req: Request, res: Response, serviceMethod: Function, requiresDateRange?: boolean) => Promise<Response>;

    beforeEach(() => {
      // Access the private method for testing
      handleReportRequest = (adminReportsController as any).handleReportRequest.bind(adminReportsController);
    });

    it('should call service method with date range and return 200 on success', async () => {
      const mockReport = { data: 'report' };
      const mockServiceMethod = jest.fn().mockResolvedValue(mockReport);
      req.query = { startDate: '2023-01-01', endDate: '2023-01-31' };

      await handleReportRequest(req as Request, res as Response, mockServiceMethod, true);

      expect(mockServiceMethod).toHaveBeenCalledWith(new Date('2023-01-01'), new Date('2023-01-31'));
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockReport);
    });

    it('should call service method without date range and return 200 on success', async () => {
      const mockReport = { data: 'report' };
      const mockServiceMethod = jest.fn().mockResolvedValue(mockReport);

      await handleReportRequest(req as Request, res as Response, mockServiceMethod, false);

      expect(mockServiceMethod).toHaveBeenCalledWith();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockReport);
    });

    it('should return 500 and error message on service method failure', async () => {
      const errorMessage = 'Service error';
      const mockServiceMethod = jest.fn().mockRejectedValue(new Error(errorMessage));
      req.query = { startDate: '2023-01-01', endDate: '2023-01-31' };

      await handleReportRequest(req as Request, res as Response, mockServiceMethod, true);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: `Erro ao gerar o relatório: ${errorMessage}` });
    });
  });

  // Test public controller methods that use handleReportRequest
  const reportMethods = [
    'getRegistrationReport',
    'getSecurityReport',
    'getUserBlocksReport',
    'getVehicleInventoryReport',
    'getRideOfferReport',
    'getRideAlterationReport',
    'getRideBookingReport',
    'getRideOccupancyReport',
    'getGeoAdherenceReport',
    'getGeoPerformanceReport',
    'getChatUsageReport',
    'getChatAdminReport',
    'getChatModerationReport',
    'getNotificationDeliveryReport',
    'getNotificationLimitsReport',
    'getComplianceReport',
    'getPrivacyComplianceReport',
    'getSessionSecurityReport',
    'getEsgReport',
  ];

  reportMethods.forEach(methodName => {
    describe(methodName, () => {
      it('should call handleReportRequest with correct service method', async () => {
        const spyHandleReportRequest = jest.spyOn(adminReportsController as any, 'handleReportRequest');
        spyHandleReportRequest.mockResolvedValue(res); // Prevent actual execution of handleReportRequest

        // Call the public method
        await (adminReportsController as any)[methodName](req as Request, res as Response);

        expect(spyHandleReportRequest).toHaveBeenCalledTimes(1);
        expect(spyHandleReportRequest).toHaveBeenCalledWith(req, res, (mockedAdminReportsService as any)[methodName], expect.any(Boolean));
      });
    });
  });

  // Test getEngagementReport separately as it doesn't use handleReportRequest
  describe('getEngagementReport', () => {
    it('should return engagement report on success', async () => {
      const mockReport = { mau: 100, dau: 50 };
      mockedAdminReportsService.getEngagementReport.mockResolvedValue(mockReport);
      req.query = { endDate: '2023-01-31' };

      await adminReportsController.getEngagementReport(req as Request, res as Response);

      expect(mockedAdminReportsService.getEngagementReport).toHaveBeenCalledWith(new Date('2023-01-31'));
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockReport);
    });

    it('should return 500 and error message on failure', async () => {
      const errorMessage = 'Engagement service error';
      mockedAdminReportsService.getEngagementReport.mockRejectedValue(new Error(errorMessage));
      req.query = { endDate: '2023-01-31' };

      await adminReportsController.getEngagementReport(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: `Erro ao gerar o relatório: ${errorMessage}` });
    });
  });

  // Test getAccessibilityReport and getLocalizationReport which have requiresDateRange: false
  describe('getAccessibilityReport', () => {
    it('should call handleReportRequest with requiresDateRange as false', async () => {
      const spyHandleReportRequest = jest.spyOn(adminReportsController as any, 'handleReportRequest');
      spyHandleReportRequest.mockResolvedValue(res);

      await adminReportsController.getAccessibilityReport(req as Request, res as Response);

      expect(spyHandleReportRequest).toHaveBeenCalledWith(req, res, mockedAdminReportsService.getAccessibilityReport, false);
    });
  });

  describe('getLocalizationReport', () => {
    it('should call handleReportRequest with requiresDateRange as false', async () => {
      const spyHandleReportRequest = jest.spyOn(adminReportsController as any, 'handleReportRequest');
      spyHandleReportRequest.mockResolvedValue(res);

      await adminReportsController.getLocalizationReport(req as Request, res as Response);

      expect(spyHandleReportRequest).toHaveBeenCalledWith(req, res, mockedAdminReportsService.getLocalizationReport, false);
    });
  });
});
