// Lógica de negócio para todos os relatórios do painel administrativo.
import { UserModel, UserStatus, UserRole } from '../../models/user';
import { VehicleModel, VehicleStatus } from '../../models/vehicle';
import { RideModel, RideStatus } from '../../models/ride';
import { ChatMessageModel } from '../../models/chat';
import { SearchEventModel } from '../../models/searchEvent';
import { RideViewEventModel } from '../../models/rideViewEvent';
import { LoginAttemptModel } from '../../models/loginAttempt';
import { PasswordResetModel } from '../../models/passwordReset';
import { AuditLogModel } from '../../models/auditLog';
import { NotificationSubscriptionModel } from '../../models/notificationSubscription';
import { NotificationEventModel } from '../../models/notificationEvent';
import { SuppressedNotificationModel } from '../../models/suppressedNotification';
import { AccessDenialLogModel } from '../../models/denialLog';
import { PrivacyRequestModel } from '../../models/privacyRequest';
import { FormalNotificationModel } from '../../models/formalNotification';
import { DataReportModel } from '../../models/dataReport';
import { SessionEventModel } from '../../models/sessionEvent';
import { BlockModel } from '../../models/block';
import { PipelineStage, Types } from 'mongoose';

class AdminReportsService {

  // =================================================================
  // == RELATÓRIOS DE USUÁRIOS
  // =================================================================

  public async getRegistrationReport(startDate: Date, endDate: Date) {
    const dateFilter = { createdAt: { $gte: startDate, $lte: endDate } };
    const pipeline: PipelineStage[]  = [
      { $match: dateFilter },
      { $unwind: { path: '$auditHistory', preserveNullAndEmptyArrays: true } },
      { $sort: { 'auditHistory.timestamp': 1 } },
      {
        $group: {
          _id: '$_id',
          createdAt: { $first: '$createdAt' },
          status: { $last: '$status' },
          decisionEntry: { $first: { $cond: [{ $in: ['$auditHistory.action', ['status_changed_to_approved', 'status_changed_to_rejected']] }, '$auditHistory', null] } }
        }
      },
      {
        $group: {
          _id: null,
          totalRegistrations: { $sum: 1 },
          approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
          rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          totalDecisionTime: { $sum: { $cond: ['$decisionEntry', { $subtract: ['$decisionEntry.timestamp', '$createdAt'] }, 0] } },
          decidedCount: { $sum: { $cond: ['$decisionEntry', 1, 0] } }
        }
      }
    ];

    const result = await UserModel.aggregate(pipeline);
    const data = result[0] || {};
    const avgDecisionTimeMs = (data.decidedCount > 0) ? (data.totalDecisionTime / data.decidedCount) : 0;

    return {
      totalRegistrations: data.totalRegistrations || 0,
      approvalRate: (data.totalRegistrations > 0) ? (data.approved / data.totalRegistrations) : 0,
      rejectionRate: (data.totalRegistrations > 0) ? (data.rejected / data.totalRegistrations) : 0,
      averageDecisionTimeHours: (avgDecisionTimeMs / (1000 * 60 * 60)).toFixed(2),
      pendingCount: data.pending || 0
    };
  }

  public async getEngagementReport(endDate: Date) {
    const thirtyDaysAgo = new Date(new Date(endDate).setDate(endDate.getDate() - 30));
    const twentyFourHoursAgo = new Date(new Date(endDate).setHours(endDate.getHours() - 24));

    const mau = await UserModel.countDocuments({ status: UserStatus.Approved, lastLogin: { $gte: thirtyDaysAgo, $lte: endDate } });
    const dau = await UserModel.countDocuments({ status: UserStatus.Approved, lastLogin: { $gte: twentyFourHoursAgo, $lte: endDate } });

    // Churn (simplificado) e outros KPIs exigiriam agregações mais complexas
    return {
      mau,
      dau,
      dauMauRatio: mau > 0 ? dau / mau : 0,
      // Espaço para Churn, Cohort, etc.
    };
  }

  public async getSecurityReport(startDate: Date, endDate: Date) {
    const dateFilter = { timestamp: { $gte: startDate, $lte: endDate } };

    const failedLogins = await LoginAttemptModel.aggregate([
      { $match: { ...dateFilter, wasSuccessful: false } },
      { $group: { _id: '$email', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    const twoFactorUsage = await UserModel.aggregate([
      { $match: { status: 'approved' } },
      {
        $group: {
          _id: '$roles',
          total: { $sum: 1 },
          with2FA: { $sum: { $cond: [{ $ifNull: ['$twoFactorSecret', false] }, 1, 0] } }
        }
      }
    ]);

    const passwordResets = await PasswordResetModel.countDocuments({ initiatedAt: { $gte: startDate, $lte: endDate } });
    const sessionRevocations = await SessionEventModel.countDocuments({ ...dateFilter, type: 'global_logout_admin' });

    return {
      topFailedLoginUsers: failedLogins,
      twoFactorAdoption: twoFactorUsage,
      passwordResetsInitiated: passwordResets,
      adminSessionRevocations: sessionRevocations
    };
  }

  public async getUserBlocksReport(startDate: Date, endDate: Date) {
    const dateFilter = { createdAt: { $gte: startDate, $lte: endDate } };

    const totalBlocks = await BlockModel.countDocuments(dateFilter);
    const topReasons = await BlockModel.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$reason', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);
    const adminReversals = await BlockModel.countDocuments({
      ...dateFilter,
      status: 'reversed_by_admin'
    });

    return {
      blocksAppliedInPeriod: totalBlocks,
      topBlockReasons: topReasons,
      administrativeReversals: adminReversals,
      impactOnBookings: "Not implemented",
    };
  }

  // =================================================================
  // == RELATÓRIOS DE VEÍCULOS
  // =================================================================

  public async getVehicleInventoryReport(startDate: Date, endDate: Date) {
    const statusCounts = await VehicleModel.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const newVehicles = await VehicleModel.countDocuments({
      createdAt: { $gte: startDate, $lte: endDate }
    });
    const pendingAnalysis = statusCounts.find(s => s._id === VehicleStatus.Pending)?.count || 0;

    return {
      activeVehicles: statusCounts.find(s => s._id === VehicleStatus.Active)?.count || 0,
      inactiveVehicles: statusCounts.find(s => s._id === VehicleStatus.Inactive)?.count || 0,
      newVehiclesInPeriod: newVehicles,
      pendingAnalysis: pendingAnalysis
    };
  }

  public async getVehicleConflictReport(startDate: Date, endDate: Date) {
    // Lógica complexa que dependeria de um log de tentativas de cadastro
    return {
      conflictAttempts: "Not implemented",
      averageResolutionTime: "Not implemented",
      approvedVsRejectedRatio: "Not implemented",
      usersImpacted: "Not implemented"
    };
  }

  // =================================================================
  // == RELATÓRIOS DE CARONAS
  // =================================================================

  public async getRideOfferReport(startDate: Date, endDate: Date) {
    const dateFilter = { createdAt: { $gte: startDate, $lte: endDate } };
    const rides = await RideModel.find(dateFilter);
    const totalRides = rides.length;
    const recurrentRides = rides.filter(r => r.isRecurrent).length;
    const totalSeatsOffered = rides.reduce((sum, ride) => sum + (ride.availableSeats + ride.passengers.filter(p => p.status === 'approved').length), 0);
    const totalSeatsFilled = rides.reduce((sum, ride) => sum + ride.passengers.filter(p => p.status === 'approved').length, 0);

    return {
      ridesPublished: totalRides,
      recurrentRideRatio: totalRides > 0 ? recurrentRides / totalRides : 0,
      totalCapacityOffered: totalSeatsOffered,
      averageOccupancyRate: totalSeatsOffered > 0 ? totalSeatsFilled / totalSeatsOffered : 0
    };
  }

  public async getRideAlterationReport(startDate: Date, endDate: Date) {
    const cancellations = await RideModel.aggregate([
      { $match: { status: RideStatus.Cancelled, updatedAt: { $gte: startDate, $lte: endDate } } },
      {
        $project: {
          antecedenceHours: { $divide: [{ $subtract: ['$departureTime', '$updatedAt'] }, 3600000] }
        }
      },
      {
        $group: {
          _id: null,
          critical: { $sum: { $cond: [{ $lt: ['$antecedenceHours', 1] }, 1, 0] } },
          shortNotice: { $sum: { $cond: [{ $and: [{ $gte: ['$antecedenceHours', 1] }, { $lt: ['$antecedenceHours', 24] }] }, 1, 0] } },
          standard: { $sum: { $cond: [{ $gte: ['$antecedenceHours', 24] }, 1, 0] } }
        }
      }
    ]);

    // Ranking de motoristas por cancelamento
    const driverRanking = await RideModel.aggregate([
      {
        $group: {
          _id: '$driver',
          totalRides: { $sum: 1 },
          cancelledRides: { $sum: { $cond: [{ $eq: ['$status', RideStatus.Cancelled] }, 1, 0] } }
        }
      },
      { $match: { totalRides: { $gt: 5 } } }, // Mínimo de 5 caronas para ser relevante
      {
        $project: {
          cancellationRate: { $divide: ['$cancelledRides', '$totalRides'] }
        }
      },
      { $sort: { cancellationRate: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'driverInfo' } },
      { $unwind: '$driverInfo' },
      { $project: { 'driverInfo.name': 1, cancellationRate: 1 } }
    ]);

    return {
      cancellationsByNotice: cancellations[0] || {},
      driverCancellationRanking: driverRanking
    };
  }

  public async getRideBookingReport(startDate: Date, endDate: Date) {
    const dateFilter = { timestamp: { $gte: startDate, $lte: endDate } };

    const searches = await SearchEventModel.countDocuments(dateFilter);
    const views = await RideViewEventModel.countDocuments(dateFilter);

    const bookingAnalysis = await RideModel.aggregate([
      { $unwind: '$passengers' },
      { $match: { 'passengers.requestedAt': { $gte: startDate, $lte: endDate } } },
      {
        $group: {
          _id: null,
          totalRequests: { $sum: 1 },
          approved: { $sum: { $cond: [{ $eq: ['$passengers.status', 'approved'] }, 1, 0] } },
          totalResponseTime: { $sum: { $cond: ['$passengers.managedAt', { $subtract: ['$passengers.managedAt', '$passengers.requestedAt'] }, 0] } },
          managedCount: { $sum: { $cond: ['$passengers.managedAt', 1, 0] } }
        }
      }
    ]);

    const data = bookingAnalysis[0] || {};
    const avgResponseTimeMs = data.managedCount > 0 ? data.totalResponseTime / data.managedCount : 0;

    return {
      searches,
      views,
      requests: data.totalRequests || 0,
      conversionRate: searches > 0 ? (data.approved || 0) / searches : 0,
      averageDriverResponseTimeHours: (avgResponseTimeMs / 3600000).toFixed(2)
    };
  }

  public async getRideOccupancyReport(startDate: Date, endDate: Date) {
    const rides = await RideModel.find({
      departureTime: { $gte: startDate, $lte: endDate },
      status: RideStatus.Completed
    });
    if (rides.length === 0) return { averagePassengers: 0, fullRidesRatio: 0 };

    const totalPassengers = rides.reduce((sum, r) => sum + r.passengers.filter(p => p.status === 'approved').length, 0);
    const fullRides = rides.filter(r => r.availableSeats === 0).length;

    return {
      averagePassengers: totalPassengers / rides.length,
      fullRidesRatio: fullRides / rides.length,
      noShows: "Not implemented",
      preventedDuplicateBookings: "Not implemented"
    };
  }

  // =================================================================
  // == RELATÓRIOS GEOGRÁFICOS
  // =================================================================

  public async getGeoAdherenceReport(startDate: Date, endDate: Date) {
    const dateFilter = { departureTime: { $gte: startDate, $lte: endDate } };
    const morningRides = await RideModel.find({ ...dateFilter, $expr: { $and: [{ $gte: [{ $hour: '$departureTime' }, 6] }, { $lt: [{ $hour: '$departureTime' }, 10] }] } }).select('origin.point destination.point intermediateStops.point');
    const eveningRides = await RideModel.find({ ...dateFilter, $expr: { $and: [{ $gte: [{ $hour: '$departureTime' }, 16] }, { $lt: [{ $hour: '$departureTime' }, 20] }] } }).select('origin.point destination.point intermediateStops.point');

    const extractPoints = (rides: any[]) => rides.flatMap(r => [r.origin.point.coordinates, r.destination.point.coordinates, ...r.intermediateStops.map((s: any) => s.point.coordinates)]);

    return {
      morningHeatmapPoints: extractPoints(morningRides),
      eveningHeatmapPoints: extractPoints(eveningRides),
      averagePassengerDistanceToPickup: "Not implemented",
      averageDriverRouteDeviation: "Not implemented"
    };
  }

  public async getGeoPerformanceReport(startDate: Date, endDate: Date) {
    const performance = await SearchEventModel.aggregate([
      { $match: { timestamp: { $gte: startDate, $lte: endDate } } },
      {
        $group: {
          _id: null,
          totalSearches: { $sum: 1 },
          totalDuration: { $sum: '$durationMs' },
          noMatchSearches: { $sum: { $cond: [{ $eq: ['$resultsCount', 0] }, 1, 0] } }
        }
      }
    ]);

    const data = performance[0] || {};
    const totalViews = await RideViewEventModel.countDocuments({ timestamp: { $gte: startDate, $lte: endDate } });

    return {
      averageSearchTimeMs: data.totalSearches > 0 ? data.totalDuration / data.totalSearches : 0,
      noMatchRate: data.totalSearches > 0 ? data.noMatchSearches / data.totalSearches : 0,
      matchQuality: "Not implemented (requires impression tracking)"
    };
  }

  // =================================================================
  // == RELATÓRIOS DE CHAT
  // =================================================================

  public async getChatUsageReport(startDate: Date, endDate: Date) {
    const dateFilter = { createdAt: { $gte: startDate, $lte: endDate } };
    const messages = await ChatMessageModel.find(dateFilter);
    const totalMessages = messages.length;

    const conversations = await ChatMessageModel.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$ride' } }
    ]);
    const totalConversations = conversations.length;

    return {
      messagesPerConversation: totalConversations > 0 ? totalMessages / totalConversations : 0,
      // Outros KPIs são complexos e deixados como "Não implementados" por enquanto
      messagesPerUser: "Not implemented",
      lateResponseConversations: "Not implemented",
    };
  }

  public async getChatPresenceReport(startDate: Date, endDate: Date) {
    // Depende de configurações no perfil do usuário que não foram modeladas
    return {
      usersWithOnlineActive: "Not implemented",
      deliveryVsReadRate: "Not implemented",
      averageFirstResponseTime: "Not implemented",
    };
  }

  public async getChatAdminReport(startDate: Date, endDate: Date) {
    const dateFilter = { timestamp: { $gte: startDate, $lte: endDate } };
    const adminReads = await AuditLogModel.countDocuments({ ...dateFilter, action: 'chat:ler' });

    const readsByAdmin = await AuditLogModel.aggregate([
      { $match: { ...dateFilter, action: 'chat:ler' } },
      { $group: { _id: '$adminUser', count: { $sum: 1 } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'adminInfo' } },
      { $unwind: '$adminInfo' },
      { $project: { adminName: '$adminInfo.name', count: 1 } }
    ]);

    return {
      adminReadsInPeriod: adminReads,
      readsByAdmin: readsByAdmin,
      repeatAccessOnSameChat: "Not implemented",
    };
  }

  public async getChatModerationReport(startDate: Date, endDate: Date) {
    const moderatedMessages = await ChatMessageModel.countDocuments({
      isModerated: true,
      'moderationDetails.moderatedAt': { $gte: startDate, $lte: endDate }
    });

    const reincidence = await ChatMessageModel.aggregate([
      { $match: { isModerated: true } },
      { $group: { _id: '$sender', moderatedCount: { $sum: 1 } } },
      { $sort: { moderatedCount: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'userInfo' } },
      { $unwind: '$userInfo' },
      { $project: { userName: '$userInfo.name', moderatedCount: 1 } }
    ]);

    return {
      moderationActions: moderatedMessages,
      escalatedCases: "Not implemented",
      userReincidence: reincidence,
    };
  }

  // =================================================================
  // == RELATÓRIOS DE NOTIFICAÇÕES
  // =================================================================

  public async getNotificationDeliveryReport(startDate: Date, endDate: Date) {
    // Depende da implementação completa de notificações
    return {
      optInRate: "Not implemented",
      sentVsDeliveredVsClicked: "Not implemented",
    };
  }
  public async getNotificationLimitsReport(startDate: Date, endDate: Date) {
    return {
      aggregationsApplied: "Not implemented",
      eventsSuppressed: "Not implemented",
    };
  }

  // =================================================================
  // == RELATÓRIOS DE ACESSIBILIDADE
  // =================================================================

  public async getAccessibilityReport() {
    const settingsAdoption = await UserModel.aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          highContrast: { $sum: { $cond: ['$accessibilitySettings.highContrast', 1, 0] } },
          largeFont: { $sum: { $cond: ['$accessibilitySettings.largeFont', 1, 0] } },
          reduceAnimations: { $sum: { $cond: ['$accessibilitySettings.reduceAnimations', 1, 0] } },
          muteSounds: { $sum: { $cond: ['$accessibilitySettings.muteSounds', 1, 0] } },
        }
      }
    ]);
    const data = settingsAdoption[0] || {};
    return {
      highContrastAdoption: data.totalUsers > 0 ? data.highContrast / data.totalUsers : 0,
      largeFontAdoption: data.totalUsers > 0 ? data.largeFont / data.totalUsers : 0,
      reduceAnimationsAdoption: data.totalUsers > 0 ? data.reduceAnimations / data.totalUsers : 0,
      muteSoundsAdoption: data.totalUsers > 0 ? data.muteSounds / data.totalUsers : 0,
    };
  }

  public async getLocalizationReport() {
    const languageDistribution = await UserModel.aggregate([
      { $group: { _id: '$languagePreference', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    return {
      languageDistribution,
      translationFallbacks: "Not implemented",
      rtlLayoutErrors: "Not implemented"
    };
  }

  // =================================================================
  // == RELATÓRIOS DE SEGURANÇA E COMPLIANCE
  // =================================================================

  public async getComplianceReport(startDate: Date, endDate: Date) {
    const dateFilter = { timestamp: { $gte: startDate, $lte: endDate } };
    const sensitiveActions = ['chat:ler', 'privacidade:emitir_relatorio', 'seguranca:ver_motivos'];
    const sensitiveLogs = await AuditLogModel.countDocuments({
      ...dateFilter,
      action: { $in: sensitiveActions }
    });
    const accessDenied = await AccessDenialLogModel.countDocuments(dateFilter);
    return {
      sensitiveLogsVolume: sensitiveLogs,
      deniedAccessAttempts: accessDenied
    };
  }

  public async getPrivacyComplianceReport(startDate: Date, endDate: Date) {
    const requests = await PrivacyRequestModel.aggregate([
      { $match: { requestedAt: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);
    const reportsIssued = await DataReportModel.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } });
    const softDeletes = await UserModel.countDocuments({ status: 'anonymized', updatedAt: { $gte: startDate, $lte: endDate } });

    return {
      requestsByType: requests,
      softDeletesExecuted: softDeletes,
      integrityReportsIssued: reportsIssued
    };
  }

  public async getSessionSecurityReport(startDate: Date, endDate: Date) {
    const globalLogouts = await SessionEventModel.countDocuments({
      type: 'global_logout_admin',
      timestamp: { $gte: startDate, $lte: endDate }
    });
    return {
      globalLogouts,
      refreshTokenRotations: "Not implemented",
      sessionsByDevice: "Not implemented"
    };
  }

  // =================================================================
  // == RELATÓRIOS DE NEGÓCIOS (ESG)
  // =================================================================

  public async getEsgReport(startDate: Date, endDate: Date) {
    const result = await RideModel.aggregate([
      { $match: { status: RideStatus.Completed, departureTime: { $gte: startDate, $lte: endDate }, distanceKm: { $exists: true } } },
      {
        $project: {
          distanceKm: 1,
          price: 1,
          passengerCount: { $size: { $filter: { input: '$passengers', as: 'p', cond: { $eq: ['$$p.status', 'approved'] } } } }
        }
      },
      {
        $group: {
          _id: null,
          totalSharedKm: { $sum: { $multiply: ['$distanceKm', '$passengerCount'] } },
          totalPassengerEconomy: { $sum: { $multiply: ['$price', '$passengerCount'] } },
          totalPassengerRides: { $sum: '$passengerCount' },
          totalRides: { $sum: 1 }
        }
      }
    ]);
    const data = result[0] || {};
    // Fator de emissão médio para carros no Brasil: ~130g CO2/km
    const co2AvoidedKg = (data.totalSharedKm * 130) / 1000;

    return {
      sharedKilometers: data.totalSharedKm || 0,
      estimatedCo2EmissionsAvoidedKg: co2AvoidedKg.toFixed(2),
      averageOccupancyPerTrip: data.totalRides > 0 ? data.totalPassengerRides / data.totalRides : 0,
      averagePassengerSavings: data.totalPassengerRides > 0 ? data.totalPassengerEconomy / data.totalPassengerRides : 0
    };
  }
}

export const adminReportsService = new AdminReportsService();
