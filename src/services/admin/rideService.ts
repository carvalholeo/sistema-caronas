// Lógica de negócio para ações administrativas em caronas.
import { IRide, IUser } from 'types';
import { RideModel } from '../../models/ride';
import { Types } from 'mongoose';
import { AuditLogModel } from 'models/auditLog';
import { AuditActionType, AuditLogCategory, AuditLogSeverityLevels, RideStatus } from 'types/enums/enums';

class AdminRidesService {
  public async getRideDetails(rideId: Types.ObjectId, adminId: Types.ObjectId): Promise<IRide | null> {
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
          resourceType: 'ride',
          resourceId: ride._id
        },
        metadata: {
          severity: AuditLogSeverityLevels.INFO
        }
      });
      await auditEntry.save();
    }
    return ride;
  }

  public async cancelRide(rideId: Types.ObjectId, adminId: Types.ObjectId, reason: string): Promise<IRide | null> {
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
          resourceType: 'ride',
          resourceId: ride._id
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

  public async forcePublishRide(rideId: Types.ObjectId, adminId: Types.ObjectId, reason: string): Promise<IRide | null> {
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
          resourceType: 'ride',
          resourceId: ride._id
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
   * @param queryParams - Objeto com os filtros (ex: status, driverId).
   */
  public async listRides(queryParams: any) {
    const filter: any = {};
    if (queryParams.status) {
      filter.status = queryParams.status;
    }
    if (queryParams.driverId && Types.ObjectId.isValid(queryParams.driverId)) {
      filter.driver = queryParams.driverId;
    }
    // Adicione mais filtros conforme necessário
    return RideModel.find(filter).populate('driver', 'name email').populate('passengers.user', 'name email');
  }

  /**
   * Atualiza os dados de uma carona existente.
   * @param rideId - O ID da carona a ser atualizada.
   * @param adminUser - O administrador que está realizando a ação.
   * @param reason - A justificativa para a alteração.
   * @param updateData - Os dados a serem atualizados.
   */
  public async updateRide(rideId: Types.ObjectId, adminUser: IUser, reason: string, updateData: any) {
    const ride = await RideModel.findById(rideId);
    if (!ride) {
      throw new Error('Carona não encontrada.');
    }

    if ([RideStatus.InProgress, RideStatus.Completed, RideStatus.Cancelled].includes(ride.status as RideStatus)) {
      throw new Error('Não é possível editar uma carona que já está em andamento, foi concluída ou cancelada.');
    }

    // Aplica as atualizações
    Object.assign(ride, updateData);

    const auditEntry = new AuditLogModel({
        actor: {
          userId: adminUser._id,
          isAdmin: true,
          ip: '::1',
        },
        action: {
          actionType: AuditActionType.RIDE_UPDATED_BY_ADMIN,
          category: AuditLogCategory.RIDE,
          detail: reason
        },
        target: {
          resourceType: 'ride',
          resourceId: ride._id,
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
