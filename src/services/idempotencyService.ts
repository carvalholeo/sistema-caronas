import { IdempotencyRequestModel, IIdempotencyRequest } from 'models/idempotency';

class IdempotencyService {
  /**
   * Verifica o status de uma chave de idempotência.
   * @param key - A chave de idempotência.
   * @returns O registro da requisição se já existir, caso contrário null.
   */
  public async getRequest(key: string): Promise<IIdempotencyRequest | null> {
    return IdempotencyRequestModel.findOne({ key });
  }

  /**
   * Inicia o processamento de uma nova requisição idempotente.
   * @param key - A chave de idempotência.
   */
  public async startRequest(key: string): Promise<void> {
    const twentyFourHours = 24 * 60 * 60 * 1000;
    const newRequest = new IdempotencyRequestModel({
      key,
      status: 'processing',
      expiresAt: new Date(Date.now() + twentyFourHours),
    });
    await newRequest.save();
  }

  /**
   * Marca uma requisição como completa e armazena a resposta.
   * @param key - A chave de idempotência.
   * @param statusCode - O código de status da resposta.
   * @param body - O corpo da resposta.
   */
  public async completeRequest(key: string, statusCode: number, body: any): Promise<void> {
    await IdempotencyRequestModel.updateOne(
      { key },
      { $set: { status: 'completed', responseStatusCode: statusCode, responseBody: body } }
    );
  }
}

export const idempotencyService = new IdempotencyService();
