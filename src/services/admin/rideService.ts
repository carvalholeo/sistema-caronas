// Lógica de negócio para ações administrativas em caronas.
import { Types } from 'mongoose';
import { IRide, IUser } from '../../types';
import { RideModel } from '../../models/ride';
import { AuditLogModel } from '../../models/auditLog';
import { AuditActionType, AuditLogCategory, AuditLogSeverityLevels, RideStatus } from '../../types/enums/enums';
import { IAdminListRidesQuery } from '@/types/requests/admin/rides';

class AdminRidesService {
  public async getRideDetails(rideId: IRide, adminId: IUser): Promise<IRide | null> {
    const ride = await RideModel.findById(rideId).populate('driver passengers.user', 'name email matricula');
    if (ride) {
      const auditEntry = new AuditLogModel({
        actor: {
          userId: adminId,
          isAdmin: true,
          ip: '::1',
        },
        action: {
          actionType: AuditActionType.RIDE_DETAILS_VIEWED_BY_ADMIN,
          category: AuditLogCategory.RIDE
        },
        target: {
          resourceType: RideModel.baseModelName,
          resourceId: ride
        },
        metadata: {
          severity: AuditLogSeverityLevels.INFO
        }
      });
      await auditEntry.save();
    }
    return ride;
  }

  public async cancelRide(rideId: IRide, adminId: IUser, reason: string): Promise<IRide | null> {
    const ride = await RideModel.findById(rideId);
    if (!ride) throw new Error("Carona não encontrada.");

    ride.status = RideStatus.Cancelled;

    const auditEntry = new AuditLogModel({
        actor: {
          userId: adminId,
          isAdmin: true,
          ip: '::1',
        },
        action: {
          actionType: AuditActionType.RIDE_CANCELLED_BY_ADMIN,
          category: AuditLogCategory.RIDE,
          detail: reason
        },
        target: {
          resourceType: RideModel.baseModelName,
          resourceId: ride
        },
        metadata: {
          severity: AuditLogSeverityLevels.WARN
        }
    });
    await auditEntry.save();

    await ride.save();
    // Aqui entraria a lógica de notificação para os passageiros
    return ride;
  }

  public async forcePublishRide(rideId: IRide, adminId: IUser, reason: string): Promise<IRide | null> {
    // Esta lógica dependeria de um status "retido por moderação" que não existe atualmente.
    // Vamos simular a alteração de um status hipotético 'PendingModeration' para 'Scheduled'.
    const ride = await RideModel.findOne({
      _id: rideId,
      status: RideStatus.Cancelled
    });
    if (!ride) throw new Error("Carona não encontrada.");

    ride.status = RideStatus.Scheduled; // Simulação

    const auditEntry = new AuditLogModel({
        actor: {
          userId: adminId,
          isAdmin: true,
          ip: '::1',
        },
        action: {
          actionType: AuditActionType.RIDE_FORCE_PUBLISHED_BY_ADMIN,
          category: AuditLogCategory.RIDE,
          detail: reason
        },
        target: {
          resourceType: RideModel.baseModelName,
          resourceId: ride
        },
        metadata: {
          severity: AuditLogSeverityLevels.WARN
        }
    });
    await auditEntry.save();

    await ride.save();
    return ride;
  }

  /**
   * Lista todas as caronas do sistema com base em filtros de query.
   * @param filters - Objeto com os filtros (ex: status, driverId).
   */
  public async listRides(filters: IAdminListRidesQuery) {
    const filter: any = {};

    if (filters.status) filter.status = filters.status;
    if (filters.driverId && Types.ObjectId.isValid(filters.driverId)) filter.driverId = filters.driverId;
    if (filters.originText) filter.originText = { $regex: filters.originText, $options: 'i' };
    if (filters.destinationText) filter.destinationText = { $regex: filters.destinationText, $options: 'i' };
    if (filters.isRecurrent) filter.isRecurrent = filters.isRecurrent;

    const sortOrder = filters.sortOrder === 'desc' ? -1 : 1;
    const sortBy = filters.sortBy || 'startDate';

    return await RideModel.find(filter)
      .sort({ [sortBy]: sortOrder })
      .populate('driver', 'name email')
      .populate('passengers.user', 'name email');
  }

  /**
   * Atualiza os dados de uma carona existente.
   * @param rideId - O ID da carona a ser atualizada.
   * @param adminUser - O administrador que está realizando a ação.
   * @param reason - A justificativa para a alteração.
   * @param updateData - Os dados a serem atualizados.
   */
  public async updateRide(rideId: IRide, adminUser: IUser, reason: string, updateData: any) {
    const ride = await RideModel.findById(rideId);
    if (!ride) {
      throw new Error('Carona não encontrada.');
    }

    if ([RideStatus.InProgress, RideStatus.Completed, RideStatus.Cancelled].includes(ride.status)) {
      throw new Error('Não é possível editar uma carona que já está em andamento, foi concluída ou cancelada.');
    }

    // Aplica as atualizações
    Object.assign(ride, updateData);

    const auditEntry = new AuditLogModel({
        actor: {
          userId: adminUser,
          isAdmin: true,
          ip: '::1',
        },
        action: {
          actionType: AuditActionType.RIDE_UPDATED_BY_ADMIN,
          category: AuditLogCategory.RIDE,
          detail: reason
        },
        target: {
          resourceType: RideModel.baseModelName,
          resourceId: ride,
          beforeState: { ...ride.toObject() },
          afterState: updateData,
        },
        metadata: {
          severity: AuditLogSeverityLevels.WARN
        }
      });
    await auditEntry.save();

    await ride.save();
    return ride;
  }
}

export const adminRidesService = new AdminRidesService();
