import { Server, Socket } from 'socket.io';
import { RideModel } from '../models/ride';
import { LocationLogModel } from '../models/locationLog';
import { BlockModel } from '../models/block';
import mongoose, { Types } from 'mongoose';
import { locationService } from 'services/locationService';
import { RideStatus, LocationLogAction } from 'types/enums/enums';

export const setupLocationSockets = (io: Server) => {
  io.on('connection', (socket: Socket) => {

    /**
     * Evento para um usuário (motorista ou passageiro) entrar na sala de localização de uma carona.
     */
    socket.on('joinRideLocationRoom', async (rideId: string) => {
      try {
        const ride = await RideModel.findById(rideId);
        if (!ride || ride.status !== RideStatus.InProgress) {
          socket.emit('locationError', 'Não é possível entrar na sala: a carona não está em andamento.');
          return;
        }

        const isDriver = ride.driver._id.toString() === socket.userId.toString();
        const isApprovedPassenger = ride.passengers.some(p => p.user._id.toString() === socket.userId.toString() && p.status === 'approved');

        if (isDriver || isApprovedPassenger) {
          const room = `ride-location-${rideId}`;
          socket.join(room);
          socket.emit('joinedRideLocationRoom', `Você entrou na sala de localização da carona ${rideId}`);
        } else {
          socket.emit('locationError', 'Você não tem permissão para acessar a localização desta carona.');
        }
      } catch (error: Error | any) {
        socket.emit('locationError', 'Ocorreu um erro ao entrar na sala de localização ' + error.message);
      }
    });

    /**
     * Evento para um motorista iniciar o compartilhamento de localização.
     */
    socket.on('startSharingLocation', async (rideId: string) => {
      const ride = await RideModel.findById(rideId);
      if (ride && ride.driver._id.toString() === socket.userId.toString()) {
        await new LocationLogModel({ ride: rideId, user: socket.userId, action: LocationLogAction.SharingStarted }).save();
      }
    });

    /**
     * Evento para um usuário enviar sua atualização de coordenadas.
     */
    socket.on('updateLocation', async (data: { rideId: Types.ObjectId; lat: number; lng: number }) => {
      const { rideId, lat, lng } = data;
      const room = `ride-location-${rideId}`;

      locationService.broadcastLocationUpdate(
        io,
        socket,
        {
          rideId,
          lat,
          lng
        }
      );

      // Verifica se o socket está na sala correta
      if (socket.rooms.has(room)) {
        const ride = await RideModel.findById(rideId).lean();
        if (!ride) return;

        const isDriver = ride.driver._id.toString() === socket.userId.toString();
        const role = isDriver ? 'driver' : 'passenger';

        // Em vez de transmitir para todos, enviamos individualmente para verificar bloqueios
        const socketsInRoom = await io.in(room).fetchSockets();

        for (const targetSocket of socketsInRoom) {
          // Não envia a localização do usuário para ele mesmo
          if (targetSocket.id === socket.id) continue;

          // Verifica se há um bloqueio mútuo
          const isBlocked = await BlockModel.findOne({
            $or: [
              { blocker: new mongoose.Types.ObjectId(socket.userId), blocked: new mongoose.Types.ObjectId(targetSocket.userId) },
              { blocker: new mongoose.Types.ObjectId(targetSocket.userId), blocked: new mongoose.Types.ObjectId(socket.userId) }
            ]
          });

          if (!isBlocked) {
            targetSocket.emit('locationUpdate', {
              userId: socket.userId,
              lat,
              lng,
              role
            });
          }
        }
      }
    });

    /**
     * Evento para um motorista parar o compartilhamento de localização.
     */
    socket.on('stopSharingLocation', async (rideId: string) => {
      const ride = await RideModel.findById(rideId);
      if (ride && ride.driver.toString() === socket.userId.toString()) {
        await new LocationLogModel({ ride: rideId, user: socket.userId, action: LocationLogAction.SharingStopped }).save();
      }
    });
  });
};
