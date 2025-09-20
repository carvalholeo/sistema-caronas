// tests/unit/sockets/locationSockets.test.ts

import { createServer, Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import mongoose from 'mongoose';

// Importamos a função que queremos testar
import { setupLocationSockets } from '../../../../src/providers/socket/locationSocket'; // Ajuste o caminho

// Mockamos todas as dependências externas
import { RideModel } from '../../../../src/models/ride';
import { LocationLogModel } from '../../../../src/models/locationLog';
import { LocationService, locationService } from '../../../../src/services/locationService';
import { PassengerStatus, RideStatus } from '../../../../src/types/enums/enums';
import { IRide, IRidePassenger, IUser } from '../../../../src/types';


jest.mock('../../../../src/services/locationService', () => ({
  locationService: {
    broadcastLocationUpdate: jest.fn().mockResolvedValue(void 0),
    removeUserLocation: jest.fn().mockResolvedValue(void 0),
  },
}));
jest.mock('../../../../src/models/ride');
jest.mock('../../../../src/models/locationLog');

const mockedRideModel = RideModel as jest.Mocked<typeof RideModel>;
const mockedLocationLogModel = LocationLogModel as jest.Mocked<typeof LocationLogModel>;
const mockedLocationService = locationService as jest.Mocked<LocationService>;

// Estendendo a interface do Socket para incluir nossa propriedade customizada 'userId'
declare module "socket.io" {
  export interface Socket {
    userId: IUser;
  }
}

describe('Location Sockets', () => {
  let io: Server;
  let clientSocket: ClientSocket;
  let httpServer: HttpServer;
  let port: number;
  let socket: Socket;

  const driverId = new mongoose.Types.ObjectId() as unknown as IUser;
  const rideId = new mongoose.Types.ObjectId() as unknown as IRide;
  const passengerApproved = { user: new mongoose.Types.ObjectId() as unknown as IUser, status: PassengerStatus.Approved } as unknown as IRidePassenger;
  const passengerPending = { user: new mongoose.Types.ObjectId() as unknown as IUser, status: PassengerStatus.Pending } as unknown as IRidePassenger;

  // --- CICLO DE VIDA DO SERVIDOR DE TESTE ---

  beforeAll((done) => {
    httpServer = createServer();
    io = new Server(httpServer);

    // Simula um middleware de autenticação que adiciona 'userId' ao socket
    io.use((innerSocket, next) => {
      innerSocket.userId = driverId;
      socket = innerSocket;
      next();
    });

    setupLocationSockets(io);

    httpServer.listen(() => {
      const address = httpServer.address();
      port = typeof address === 'string' ? 0 : address!.port;
      done();
    });
  });

  afterAll(() => {
    io.close();
    httpServer.close();
  });

  // --- CICLO DE VIDA DO CLIENTE DE TESTE ---

  beforeEach((done) => {
    // Conecta um novo cliente antes de cada teste para garantir isolamento
    clientSocket = Client(`http://localhost:${port}`, {
      forceNew: true, // Garante uma nova conexão
    });

    clientSocket.on('connect', () => {
      done();
    });
  });

  afterEach(() => {
    if (clientSocket.connected) {
      clientSocket.disconnect();
    }
    jest.clearAllMocks();
  });

  // --- TESTES DOS EVENTOS ---

  describe('event: joinRideLocationRoom', () => {
    it('deve permitir que um motorista entre na sala de uma carona em andamento', (done) => {
      socket.userId = driverId;

      const mockRide = {
        _id: rideId,
        status: RideStatus.InProgress,
        driver: driverId,
        passengers: [passengerApproved, passengerPending],
      };
      mockedRideModel.findById.mockResolvedValue(mockRide as any);

      // Emite o evento do cliente para o servidor
      clientSocket.emit('joinRideLocationRoom', rideId);
      // Escuta a resposta do servidor
      clientSocket.on('joinedRideLocationRoom', (message: string) => {
        expect(message).toBe(`Você entrou na sala de localização da carona ${rideId}`);
        done();
      });

      clientSocket.on('locationError', (errorMessage) => {
        done(errorMessage);
      });
    });

    it('deve emitir um erro se a carona não estiver em andamento', (done) => {
      const mockRide = {
        _id: rideId,
        status: RideStatus.Completed, // Status incorreto
        driver: driverId,
        passengers: [passengerApproved, passengerPending],
      };
      mockedRideModel.findById.mockResolvedValue(mockRide as any);

      clientSocket.on('locationError', (errorMessage: string) => {
        expect(errorMessage).toContain('a carona não está em andamento');
        done();
      });

      clientSocket.emit('joinRideLocationRoom', rideId);
    });

    it('deve emitir um erro se o usuário não for motorista ou passageiro aprovado', (done) => {
      const anotherUserId = new mongoose.Types.ObjectId() as unknown as IUser;
      io.use((socket, next) => {
        socket.userId = anotherUserId;
        next();
      });
      const mockRide = {
        _id: rideId,
        status: RideStatus.InProgress,
        driver: anotherUserId, // Outro motorista
        passengers: [passengerApproved, passengerPending],
      };
      mockedRideModel.findById.mockResolvedValue(mockRide as any);

      clientSocket.on('locationError', (errorMessage: string) => {
        expect(errorMessage).toContain('Você não tem permissão');
        done();
      });

      clientSocket.emit('joinRideLocationRoom', rideId);
    });
  });

  describe('event: startSharingLocation', () => {
    it('deve criar um log quando o motorista inicia o compartilhamento', async () => {
      socket.userId = driverId;

      const mockRide = {
        _id: rideId,
        driver: driverId,
      };
      mockedRideModel.findById.mockResolvedValue(mockRide as any);
      const mockSave = jest.fn().mockResolvedValue(true);
      (mockedLocationLogModel as unknown as jest.Mock).mockImplementation(() => ({
        save: mockSave,
      }));

      clientSocket.emit('startSharingLocation', rideId);

      // Pequena espera para a operação assíncrona do servidor completar
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(mockSave).toHaveBeenCalledTimes(1);
    });
  });

  describe('event: updateLocation', () => {
    it('deve chamar o locationService para transmitir a atualização', async () => {
      const data = {
        rideId: rideId._id.toString(),
        lat: -23.55,
        lng: -46.63,
      };

      clientSocket.emit('updateLocation', data);

      await new Promise((resolve) => {
        setTimeout(resolve, 200)
      });
      socket.on('locationUpdate', (response) => {
        expect(response).toEqual(data);
      });
      expect(mockedLocationService.broadcastLocationUpdate).toHaveBeenCalledTimes(1);
      expect((mockedLocationService).broadcastLocationUpdate).toHaveBeenCalledWith(
        io,
        socket,
        data
      );

      // Verificamos se nosso serviço mockado foi chamado com os argumentos corretos
      // O 'expect.anything()' é usado para o 'io' e o 'socket', que são objetos complexos
    });
  });
});