// Importamos as funções que queremos testar
import { connectToRedis, getRedisClient, closeRedisConnection } from '../../../../src/providers/cache/redis';

// Importamos o 'createClient' para que o Jest saiba o que mockar
import { createClient } from 'redis';

jest.mock('../../../../src/utils/logger');

// --- SETUP DOS MOCKS ---
const mockConnect = jest.fn().mockResolvedValue(undefined);
const mockQuit = jest.fn().mockResolvedValue(undefined);
const mockSet = jest.fn().mockResolvedValue(undefined);
const mockGet = jest.fn().mockResolvedValue(undefined);

jest.mock('redis', () => ({
  createClient: jest.fn().mockImplementation(() => ({
    connect: mockConnect,
    quit: mockQuit,
    set: mockSet,
    get: mockGet,
  })),
}));

const mockedCreateClient = createClient as jest.Mock;

describe('Redis Connection Manager', () => {
  // Guardamos o process.env original para restaurá-lo depois
  const originalEnv = process.env;

  beforeEach(() => {
    // Resetamos os módulos para que a variável 'canRedisBeEnabled' seja reavaliada
    jest.resetModules();
    // Restauramos as variáveis de ambiente e limpamos os mocks
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  afterAll(() => {
    // Restauração final do ambiente
    process.env = originalEnv;
  });

  // --- CENÁRIO 1: REDIS HABILITADO ---
  describe('when Redis is enabled', () => {
    beforeEach(() => {
      // Forçamos a variável de ambiente para este conjunto de testes
      process.env.ENABLE_REDIS = 'true';
    });

    afterEach(async () => {
      await closeRedisConnection();
    });

    // Os testes que você já tinha agora vivem aqui dentro
    it('deve criar e conectar um novo cliente na primeira chamada', async () => {
      const client = await connectToRedis();

      expect(mockedCreateClient).toHaveBeenCalledTimes(1);
      expect(mockedCreateClient).toHaveBeenCalledWith({ url: 'redis://localhost:6379' });
      expect(mockConnect).toHaveBeenCalledTimes(1);
      expect(client).toBeDefined();
    });

    it('deve ser capaz de gravar e ler um valor', async () => {
      mockSet.mockResolvedValue(undefined);
      mockGet.mockResolvedValue('hello-world');

      // Conecta
      await connectToRedis();
      // Pega o cliente
      const client = getRedisClient();
      // await new Promise(resolve => setTimeout(resolve, 20000));

      // Testa comandos reais do Redis
      await client.set('test-key', 'hello-world');
      const value = await client.get('test-key');

      expect(value).toBe('hello-world');

      // Desconecta
      await closeRedisConnection();
    });

    it('deve retornar o cliente existente em chamadas subsequentes', async () => {
      const client1 = await connectToRedis();
      const client2 = await connectToRedis();

      // expect(mockedCreateClient).toHaveBeenCalledTimes(1);
      expect(mockConnect).toHaveBeenCalledTimes(1);
      expect(client1).toBe(client2);
    });

    it('getRedisClient deve retornar o cliente previamente inicializado', async () => {
      const connectedClient = await connectToRedis();
      const client = getRedisClient();
      expect(client).toBe(connectedClient);
    });

    it('closeRedisConnection deve chamar o método quit do cliente', async () => {
      await connectToRedis();
      await closeRedisConnection();

      expect(mockQuit).toHaveBeenCalledTimes(1);
      expect(() => getRedisClient()).toThrow('Redis client not initialized');
    });
  });

  // --- CENÁRIO 2: REDIS DESABILITADO ---
  describe('when Redis is disabled', () => {
    beforeEach(async () => {
      // Garantimos que a variável não esteja como 'true'
      process.env.ENABLE_REDIS = 'false';
      await closeRedisConnection();
    });

    it('connectToRedis não deve criar um cliente', async () => {
      // Act: Tenta conectar
      await connectToRedis();

      // Assert: Garante que o cliente Redis nunca foi criado nem conectado
      expect(mockedCreateClient).not.toHaveBeenCalled();
      expect(mockConnect).not.toHaveBeenCalled();
    });

    it('getRedisClient deve sempre lançar um erro', () => {
      // Act & Assert: Mesmo após tentar conectar, obter o cliente deve falhar
      expect(() => getRedisClient()).toThrow('Redis not enabled');
    });

    it('closeRedisConnection não deve fazer nada', async () => {
      // Act: Tenta fechar uma conexão que não pode existir
      await closeRedisConnection();

      // Assert: Garante que o método quit nunca foi chamado
      expect(mockQuit).not.toHaveBeenCalled();
    });
  });
});
