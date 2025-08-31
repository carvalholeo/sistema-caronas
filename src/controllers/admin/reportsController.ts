import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { adminReportsService } from '../../services/admin/reportsService';

class AdminReportsController {

  // Helper para padronizar o tratamento de erros e a chamada de serviço
  private async handleReportRequest(req: Request, res: Response, serviceMethod: Function, requiresDateRange: boolean = true) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      let report;
      if (requiresDateRange) {
        const { startDate, endDate } = req.query;
        report = await serviceMethod(new Date(startDate as string), new Date(endDate as string));
      } else {
        report = await serviceMethod();
      }
      return res.status(200).json(report);
    } catch (error: Error | any) {
      return res.status(500).json({ message: `Erro ao gerar o relatório: ${error.message}` });
    }
  }

  // =================================================================
  // == Controladores de Relatórios
  // =================================================================

  public async getRegistrationReport(req: Request, res: Response): Promise<Response> {
    return this.handleReportRequest(req, res, adminReportsService.getRegistrationReport);
  }

  public async getEngagementReport(req: Request, res: Response): Promise<Response> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
      const { endDate } = req.query;
      const report = await adminReportsService.getEngagementReport(new Date(endDate as string));
      return res.status(200).json(report);
    } catch (error: Error | any) {
      return res.status(500).json({ message: `Erro ao gerar o relatório: ${error.message}` });
    }
  }

  public async getSecurityReport(req: Request, res: Response): Promise<Response> {
    return this.handleReportRequest(req, res, adminReportsService.getSecurityReport);
  }

  public async getUserBlocksReport(req: Request, res: Response): Promise<Response> {
    return this.handleReportRequest(req, res, adminReportsService.getUserBlocksReport);
  }

  public async getVehicleInventoryReport(req: Request, res: Response): Promise<Response> {
    return this.handleReportRequest(req, res, adminReportsService.getVehicleInventoryReport);
  }

  // public async getVehicleConflictReport(req: Request, res: Response): Promise<Response> {
  //   return this.handleReportRequest(req, res, adminReportsService.getVehicleConflictReport);
  // }

  public async getRideOfferReport(req: Request, res: Response): Promise<Response> {
    return this.handleReportRequest(req, res, adminReportsService.getRideOfferReport);
  }

  public async getRideAlterationReport(req: Request, res: Response): Promise<Response> {
    return this.handleReportRequest(req, res, adminReportsService.getRideAlterationReport);
  }

  public async getRideBookingReport(req: Request, res: Response): Promise<Response> {
    return this.handleReportRequest(req, res, adminReportsService.getRideBookingReport);
  }

  public async getRideOccupancyReport(req: Request, res: Response): Promise<Response> {
    return this.handleReportRequest(req, res, adminReportsService.getRideOccupancyReport);
  }

  public async getGeoAdherenceReport(req: Request, res: Response): Promise<Response> {
    return this.handleReportRequest(req, res, adminReportsService.getGeoAdherenceReport);
  }

  public async getGeoPerformanceReport(req: Request, res: Response): Promise<Response> {
    return this.handleReportRequest(req, res, adminReportsService.getGeoPerformanceReport);
  }

  public async getChatUsageReport(req: Request, res: Response): Promise<Response> {
    return this.handleReportRequest(req, res, adminReportsService.getChatUsageReport);
  }

  // public async getChatPresenceReport(req: Request, res: Response): Promise<Response> {
  //   return this.handleReportRequest(req, res, adminReportsService.getChatPresenceReport);
  // }

  public async getChatAdminReport(req: Request, res: Response): Promise<Response> {
    return this.handleReportRequest(req, res, adminReportsService.getChatAdminReport);
  }

  public async getChatModerationReport(req: Request, res: Response): Promise<Response> {
    return this.handleReportRequest(req, res, adminReportsService.getChatModerationReport);
  }

  // public async getNotificationDeliveryReport(req: Request, res: Response): Promise<Response> {
  //   return this.handleReportRequest(req, res, adminReportsService.getNotificationDeliveryReport);
  // }

  // public async getNotificationLimitsReport(req: Request, res: Response): Promise<Response> {
  //   return this.handleReportRequest(req, res, adminReportsService.getNotificationLimitsReport);
  // }

  public async getAccessibilityReport(req: Request, res: Response): Promise<Response> {
    return this.handleReportRequest(req, res, adminReportsService.getAccessibilityReport, false);
  }

  public async getLocalizationReport(req: Request, res: Response): Promise<Response> {
    return this.handleReportRequest(req, res, adminReportsService.getLocalizationReport, false);
  }

  public async getComplianceReport(req: Request, res: Response): Promise<Response> {
    return this.handleReportRequest(req, res, adminReportsService.getComplianceReport);
  }

  public async getPrivacyComplianceReport(req: Request, res: Response): Promise<Response> {
    return this.handleReportRequest(req, res, adminReportsService.getPrivacyComplianceReport);
  }

  public async getSessionSecurityReport(req: Request, res: Response): Promise<Response> {
    return this.handleReportRequest(req, res, adminReportsService.getSessionSecurityReport);
  }

  public async getEsgReport(req: Request, res: Response): Promise<Response> {
    return this.handleReportRequest(req, res, adminReportsService.getEsgReport);
  }
}

export const adminReportsController = new AdminReportsController();

