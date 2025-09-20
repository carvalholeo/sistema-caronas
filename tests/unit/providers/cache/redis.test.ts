// tests/unit/utils/redis.test.ts

// Importamos as funções que queremos testar
import { connectToRedis, getRedisClient, closeRedisConnection } from '../../../../src/providers/cache/redis'; // Ajuste o caminho

// Importamos o 'createClient' para que o Jest saiba o que mockar
import { createClient } from 'redis';

// --- SETUP DOS MOCKS ---

// Criamos funções mock para os métodos do cliente que nosso código usa: connect e quit
const mockConnect = jest.fn().mockResolvedValue(undefined);
const mockQuit = jest.fn().mockResolvedValue(undefined);

// Mockamos a biblioteca 'redis' inteira.
// A função createClient agora retornará nosso cliente falso com os métodos mockados.
jest.mock('redis', () => ({
  createClient: jest.fn().mockImplementation(() => ({
    connect: mockConnect,
    quit: mockQuit,
  })),
}));

// Pegamos uma referência tipada ao nosso createClient mockado para facilitar as asserções
const mockedCreateClient = createClient as jest.Mock;


describe('Redis Connection Manager', () => {

  // Limpamos os mocks e, crucialmente, resetamos os módulos antes de cada teste.
  // Isso garante que a variável 'client' no topo do seu arquivo seja resetada para 'null' a cada 'it'.
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  // Garantimos que a conexão seja fechada após cada teste para não vazar estado
  afterEach(async () => {
    await closeRedisConnection();
  });


  describe('connectToRedis', () => {
    it('deve criar e conectar um novo cliente na primeira chamada', async () => {
      // Act: Chama a função de conexão
      const client = await connectToRedis();

      // Assert: Verifica se tudo ocorreu como esperado
      expect(mockedCreateClient).toHaveBeenCalledTimes(1);
      expect(mockedCreateClient).toHaveBeenCalledWith({ url: 'redis://localhost:6379' });
      expect(mockConnect).toHaveBeenCalledTimes(1);
      expect(client).toBeDefined();
    });

    it('deve retornar o cliente existente em chamadas subsequentes, sem criar um novo', async () => {
      // Act: Chama a função de conexão duas vezes
      const client1 = await connectToRedis();
      const client2 = await connectToRedis();

      // Assert: createClient e connect só devem ter sido chamados uma vez (na primeira chamada)
      expect(mockedCreateClient).toHaveBeenCalledTimes(1);
      expect(mockConnect).toHaveBeenCalledTimes(1);
      expect(client1).toBe(client2); // Verifica se é a mesma instância
    });
  });


  describe('getRedisClient', () => {
    it('deve lançar um erro se o cliente não for inicializado primeiro', () => {
      // Act & Assert: Tenta obter o cliente sem conectar e espera um erro
      expect(() => getRedisClient()).toThrow('Redis client not initialized');
    });

    it('deve retornar o cliente previamente inicializado', async () => {
      // Arrange: Conecta primeiro para inicializar o cliente
      const connectedClient = await connectToRedis();

      // Act: Obtém o cliente através da função get
      const client = getRedisClient();

      // Assert: Verifica se o cliente retornado é o mesmo da conexão
      expect(client).toBe(connectedClient);
    });
  });


  describe('closeRedisConnection', () => {
    it('deve chamar o método quit do cliente e resetar a instância', async () => {
      // Arrange: Conecta para garantir que há um cliente para fechar
      await connectToRedis();

      // Act: Fecha a conexão
      await closeRedisConnection();

      // Assert: Verifica se o método quit foi chamado
      expect(mockQuit).toHaveBeenCalledTimes(1);

      // Assert: Verifica se o cliente foi resetado (tentar obtê-lo deve dar erro)
      expect(() => getRedisClient()).toThrow('Redis client not initialized');
    });

    it('não deve fazer nada se não houver conexão ativa', async () => {
      // Act: Tenta fechar uma conexão que nunca foi aberta
      await closeRedisConnection();

      // Assert: Garante que o método quit nunca foi chamado
      expect(mockQuit).not.toHaveBeenCalled();
    });
  });

});