import { Server, Socket } from 'socket.io';
import { RideModel } from 'models/ride';
import { LocationLogModel } from 'models/locationLog';
import { Types } from 'mongoose';
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

        const driverId = (ride.driver._id as Types.ObjectId).toString();
        const socketUserId = (socket.userId._id as Types.ObjectId).toString();

        const isDriver = driverId === socketUserId;
        const isApprovedPassenger = ride.passengers.some(p => {
          const passengerId = (p.user._id as Types.ObjectId).toString();
          return passengerId === socketUserId && p.status === 'approved'
        });

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
      if (!ride) return;


      const driverId = (ride.driver._id as Types.ObjectId).toString();
      const socketUserId = (socket.userId._id as Types.ObjectId).toString();

      if (driverId === socketUserId) {
        await new LocationLogModel({ ride: rideId, user: socket.userId, action: LocationLogAction.SharingStarted }).save();
      }
    });

    /**
     * Evento para um usuário enviar sua atualização de coordenadas.
     */
    socket.on('updateLocation', async (data: { rideId: Types.ObjectId; lat: number; lng: number }) => {
      const { rideId, lat, lng } = data;

      locationService.broadcastLocationUpdate(
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
      const ride = await RideModel.findById(rideId);
      if (!ride) return;

      const driverId = (ride.driver._id as Types.ObjectId).toString();
      const socketUserId = (socket.userId._id as Types.ObjectId).toString();

      if (driverId === socketUserId) {
        await new LocationLogModel({ ride: rideId, user: socket.userId, action: LocationLogAction.SharingStopped }).save();
      }
    });
  });
};
