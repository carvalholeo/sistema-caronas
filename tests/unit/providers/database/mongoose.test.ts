// tests/unit/providers/database/mongoose.test.ts

// Importamos apenas os tipos necessários no topo
import mongoose, { Mongoose } from 'mongoose';

// --- SETUP DAS VARIÁVEIS DE TESTE ---

// Declaramos as variáveis que vamos usar em um escopo mais alto
let connectToDatabase: () => Promise<Mongoose>;
let closeDatabaseConnection: () => Promise<void>;
let mockedMongoose: jest.Mocked<typeof mongoose>;
let mockMongooseInstance: { disconnect: jest.Mock };

describe('Database Connection Manager', () => {

  // O beforeEach agora vai cuidar de toda a configuração,
  // garantindo um ambiente limpo para cada teste.
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules(); // 1. Limpa o cache de módulos

    // 2. Prepara a instância mockada que será retornada pela conexão
    mockMongooseInstance = {
      disconnect: jest.fn().mockResolvedValue(undefined),
    };

    // 3. Cria o mock do Mongoose APÓS o reset
    jest.mock('mongoose', () => ({
      set: jest.fn(),
      connect: jest.fn().mockResolvedValue(mockMongooseInstance),
    }));

    // 4. RE-IMPORTA as dependências mockadas e o nosso módulo a ser testado
    mockedMongoose = require('mongoose');
    const dbModule = require('../../../../src/providers/database/mongoose'); // Ajuste o caminho
    connectToDatabase = dbModule.connectToDatabase;
    closeDatabaseConnection = dbModule.closeDatabaseConnection;
  });

  describe('connectToDatabase', () => {
    it('deve configurar e conectar ao banco de dados na primeira chamada', async () => {
      const client = await connectToDatabase();

      expect(mockedMongoose.set).toHaveBeenCalledWith('runValidators', true);
      expect(mockedMongoose.set).toHaveBeenCalledWith('autoIndex', true);
      expect(mockedMongoose.connect).toHaveBeenCalledTimes(1);
      expect(client).toBe(mockMongooseInstance);
    });

    it('deve retornar o cliente existente em chamadas subsequentes sem reconectar', async () => {
      await connectToDatabase();
      await connectToDatabase();

      expect(mockedMongoose.connect).toHaveBeenCalledTimes(1);
    });
  });

  describe('closeDatabaseConnection', () => {
    it('deve desconectar o cliente e resetar a instância', async () => {
      const client = await connectToDatabase();
      const mockDisconnect = client.disconnect;

      await closeDatabaseConnection();

      expect(mockDisconnect).toHaveBeenCalledTimes(1);

      // Conecta novamente para provar que a instância foi resetada
      await connectToDatabase();
      expect(mockedMongoose.connect).toHaveBeenCalledTimes(2);
    });

    it('não deve fazer nada se não houver conexão ativa', async () => {
      await closeDatabaseConnection();

      // A asserção agora funciona, pois mockMongooseInstance está sempre definido
      expect(mockMongooseInstance.disconnect).not.toHaveBeenCalled();
    });
  });
});