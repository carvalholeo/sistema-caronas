// Lógica de negócio para ações administrativas em caronas.
import { IRide, IUser } from 'types';
import { RideModel } from '../../models/ride';
import { Types } from 'mongoose';
import { InternalAuditLogModel } from 'models/internalAuditLogSchema';
import { RideStatus } from 'types/enums/enums';

class AdminRidesService {
  public async listAllRides(): Promise<IRide[]> {
    return RideModel.find().populate('driver', 'name').sort({ createdAt: -1 });
  }

  public async getRideDetails(rideId: Types.ObjectId, adminId: Types.ObjectId): Promise<IRide | null> {
    const ride = await RideModel.findById(rideId).populate('driver passengers.user', 'name email matricula');
    if (ride) {
      const auditEntry = new InternalAuditLogModel({ action: 'details_viewed_by_admin', adminUser: adminId })
      ride.auditHistory.push(auditEntry);
      await ride.save();
    }
    return ride;
  }

  public async editRide(rideId: Types.ObjectId, adminId: Types.ObjectId, reason: string, updateData: object): Promise<IRide | null> {
    const ride = await RideModel.findById(rideId);
    if (!ride) throw new Error("Carona não encontrada.");
    if ([RideStatus.InProgress, RideStatus.Completed].includes(ride.status)) throw new Error("Não é possível editar caronas em andamento ou finalizadas.");

    const oldData = { ...ride.toObject() };
    Object.assign(ride, updateData);
    const auditEntry = new InternalAuditLogModel({ action: 'edited_by_admin', adminUser: adminId, reason, details: { from: oldData, to: updateData } });
    ride.auditHistory.push(auditEntry);
    await ride.save();
    return ride;
  }

  public async cancelRide(rideId: Types.ObjectId, adminId: Types.ObjectId, reason: string): Promise<IRide | null> {
    const ride = await RideModel.findById(rideId);
    if (!ride) throw new Error("Carona não encontrada.");

    ride.status = RideStatus.Cancelled;
    const auditEntry = new InternalAuditLogModel({ action: 'cancelled_by_admin', adminUser: adminId, reason });
    ride.auditHistory.push(auditEntry);

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
    const auditEntry = new InternalAuditLogModel({ action: 'force_published_by_admin', adminUser: adminId, reason });
    ride.auditHistory.push(auditEntry);

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

    // Adiciona o registro de auditoria na própria carona
    const auditEntry = new InternalAuditLogModel({
      action: 'admin_ride_updated',
      adminUser: adminUser._id,
      timestamp: new Date(),
      reason: reason,
      details: JSON.stringify(updateData)
    });
    ride.auditHistory.push(auditEntry);

    await ride.save();
    return ride;
  }
}

export const adminRidesService = new AdminRidesService();
