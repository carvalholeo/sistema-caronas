import { Server, Socket } from 'socket.io';
import { RideModel } from '../models/ride';
import { LocationLogModel } from '../models/locationLog';
import { BlockModel } from '../models/block';
import { RideStatus, LocationLogAction } from '../types/enums/enums';
import { IRide, IUser } from '../types';

export class LocationService {

  /**
   * Verifica se um usuário pode entrar na sala de localização de uma carona.
   * @param rideId - O ID da carona.
   * @param userId - O ID do usuário.
   * @returns O objeto da carona se a validação for bem-sucedida.
   * @throws Um erro se o usuário não tiver permissão ou a carona não estiver em andamento.
   */
  public async validateUserForLocationRoom(rideId: IRide, userId: IUser) {
    const ride = await RideModel.findById(rideId); // .lean() para performance

    if (!ride) {
      throw new Error('Carona não encontrada.');
    }

    const driverId = ride.driver;
    const serviceUserId = userId;

    const isDriver = driverId === serviceUserId;
    const isApprovedPassenger = ride.passengers.some(p => p.user === serviceUserId && p.status === 'approved');

    const isRideAbleToShareLocation = [RideStatus.Scheduled, RideStatus.InProgress].includes(ride.status);
    const canUserSendLocation = isDriver || isApprovedPassenger;

    const messageLocationPermissionNotFound = 'Você não tem permissão para acessar a localização desta carona.';
    const messageRideCannotReceiveLocation = 'Não é possível entrar na sala: a carona não iniciou ou não está em andamento.';

    if (!isRideAbleToShareLocation) {
      throw new Error(messageRideCannotReceiveLocation);
    }

    if (!canUserSendLocation) {
      throw new Error(messageLocationPermissionNotFound);
    }

    return ride;
  }

  /**
   * Registra o início ou fim do compartilhamento de localização no log.
   * @param rideId - O ID da carona.
   * @param userId - O ID do usuário (motorista).
   * @param action - A ação a ser registrada (início ou fim).
   */
  public async logSharingActivity(rideId: IRide, userId: IUser, action: LocationLogAction): Promise<void> {
    const ride = await RideModel.findById(rideId);
    // Garante que apenas o motorista da carona possa registrar essa atividade
    if (!ride) return;

    const driverId = ride.driver.toString();
    const serviceUserId = userId.toString();

    if (driverId === serviceUserId) {
      await new LocationLogModel({
        ride: rideId,
        user: userId,
        action
      }).save();
    }
  }

  /**
   * Transmite a atualização de localização de um usuário para os outros participantes da carona.
   * A lógica de verificação de bloqueios e regras de compartilhamento é aplicada aqui.
   * @param io - A instância do servidor Socket.IO.
   * @param socket - O socket do usuário que enviou a atualização.
   * @param data - Os dados da localização (rideId, lat, lng).
   */
  public async broadcastLocationUpdate(
    io: Server,
    socket: Socket,
    data: { rideId: IRide; lat: number; lng: number }
  ): Promise<void> {
    const { rideId, lat, lng } = data;
    const room = `ride-location-${rideId}`;

    if (!socket.rooms.has(room)) return;

    const ride = await RideModel.findById(rideId);
    if (!ride) return;

    const driverId = ride.driver;
    const socketUserId = socket.userId;

    const isSenderDriver = driverId === socketUserId;
    const senderRole = isSenderDriver ? 'driver' : 'passenger';

    const socketsInRoom = await io.in(room).fetchSockets();

    for (const targetSocket of socketsInRoom) {
      if (targetSocket.id === socket.id) continue;

      const isTargetDriver = driverId === targetSocket.userId;

      // REGRA: Se o remetente é um passageiro, só envia a localização para o motorista.
      if (!isSenderDriver && !isTargetDriver) {
        continue;
      }

      const isBlocked = await BlockModel.findOne({
        $or: [
          { blocker: socket.userId, blocked: targetSocket.userId },
          { blocker: targetSocket.userId, blocked: socket.userId }
        ]
      });

      if (!isBlocked) {
        targetSocket.emit('locationUpdate', {
          userId: socket.userId,
          lat,
          lng,
          role: senderRole
        });
      }
    }
  }

  /**
   * Lida com a desconexão de um usuário, notificando os outros participantes para remover sua localização do mapa.
   * @param socket - O socket do usuário que desconectou.
   */
  public async removeUserLocation(socket: Socket): Promise<void> {
    // Encontra todas as salas de localização das quais o socket fazia parte.
    const locationRooms = Array.from(socket.rooms).filter(room => room.startsWith('ride-location-'));

    // Para cada sala, notifica os outros membros que este usuário saiu.
    for (const room of locationRooms) {
      // Emite para todos os outros na sala, exceto o próprio socket que está desconectando.
      socket.to(room).emit('userLocationRemoved', { userId: socket.userId });
    }
  }
}

export const locationService = new LocationService();