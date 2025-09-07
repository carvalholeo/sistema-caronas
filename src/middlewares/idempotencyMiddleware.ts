import { Request, Response, NextFunction } from 'express';
import { idempotencyService } from 'services/idempotencyService';
import logger from 'utils/logger';

export const idempotencyMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  // Aplica o middleware apenas para métodos que alteram dados
  if (!['POST', 'PATCH', 'PUT'].includes(req.method)) {
    return next();
  }

  const idempotencyKey = req.headers['x-request-key'] as string;

  try {
    const existingRequest = await idempotencyService.getRequest(idempotencyKey);

    if (existingRequest) {
      // Caso 1: A requisição original ainda está sendo processada
      if (existingRequest.status === 'processing') {
        return res.status(409).json({ message: 'Requisição em processamento. Tente novamente em alguns instantes.' });
      }

      // Caso 2: A requisição já foi concluída, retorna a resposta salva
      if (existingRequest.status === 'completed') {
        return res.status(existingRequest.responseStatusCode!).json(existingRequest.responseBody);
      }
    }

    // Caso 3: É uma nova chave de idempotência
    await idempotencyService.startRequest(idempotencyKey);

    // Truque para capturar a resposta depois que o controlador a enviar
    const originalJson = res.json;
    res.json = (body) => {
      // Salva a resposta antes de enviá-la
      idempotencyService.completeRequest(idempotencyKey, res.statusCode, body);
      return originalJson.call(res, body);
    };

    next();

  } catch (error) {
    // Em caso de erro, não bloqueia a requisição, mas loga o problema
    logger.error('Erro no middleware de idempotência:', error);
    next();
  }
};
