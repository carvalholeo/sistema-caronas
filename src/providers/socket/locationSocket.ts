import { Server, Socket } from 'socket.io';
import { RideModel } from '../../models/ride';
import { LocationLogModel } from '../../models/locationLog';
import { locationService } from '../../services/locationService';
import { RideStatus, LocationLogAction } from '../../types/enums/enums';
import { IRide } from '../../types';

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

        const driverId = ride.driver;
        const socketUserId = socket.userId;

        const isDriver = driverId === socketUserId;
        const isApprovedPassenger = ride.passengers.some(p => {
          const passengerId = p.user;
          return passengerId === socketUserId && p.status === 'approved'
        });

        if (isDriver || isApprovedPassenger) {
          const room = `ride-location-${rideId}`;
          socket.join(room);
          return socket.emit('joinedRideLocationRoom', `Você entrou na sala de localização da carona ${rideId}`);
        }
        return socket.emit('locationError', 'Você não tem permissão para acessar a localização desta carona.');

      } catch (error: Error | any) {
        return socket.emit('locationError', 'Ocorreu um erro ao entrar na sala de localização ' + error.message);
      }
    });

    /**
     * Evento para um motorista iniciar o compartilhamento de localização.
     */
    socket.on('startSharingLocation', async (rideId: string) => {
      const ride = await RideModel.findById(rideId);
      if (!ride) return;

      const driverId = ride.driver;
      const socketUserId = socket.userId;

      if (driverId !== socketUserId) {
        return;
      }
      return await new LocationLogModel({ ride: rideId, user: socket.userId, action: LocationLogAction.SharingStarted }).save();
    });

    /**
     * Evento para um usuário enviar sua atualização de coordenadas.
     */
    socket.on('updateLocation', async (data: { rideId: IRide; lat: number; lng: number }) => {
      const { rideId, lat, lng } = data;

      await locationService.broadcastLocationUpdate(
        io,
        socket,
        {
          rideId,
          lat,
          lng
        }
      );
    });

    /**
     * Evento para um motorista parar o compartilhamento de localização.
     */
    socket.on('stopSharingLocation', async (rideId: string) => {
      await handleDisconnection(rideId);
    });

    socket.on('disconnect', async (rideId: string) => {
      await handleDisconnection(rideId);
    });

    async function handleDisconnection(rideId: string){
      const ride = await RideModel.findById(rideId);
      if (!ride) return;

      const driverId = ride.driver;
      const socketUserId = socket.userId;

      if (driverId !== socketUserId) {
        return;
      }
      await locationService.removeUserLocation(socket);
      return await new LocationLogModel({ ride: rideId, user: socket.userId, action: LocationLogAction.SharingStopped }).save();
    }
  });
};