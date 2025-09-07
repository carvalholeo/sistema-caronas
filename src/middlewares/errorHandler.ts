import { Request, Response } from 'express';
import logger from 'utils/logger';

interface CustomError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

/**
 * Middleware de tratamento de erros centralizado.
 * Captura todos os erros que ocorrem na aplicação e envia uma resposta JSON padronizada.
 */
export const errorHandler = (err: CustomError, req: Request, res: Response) => {
  // Define o status code do erro. Padrão para 500 (Internal Server Error) se não especificado.
  const statusCode = err.statusCode || 500;

  // Loga o erro no console para depuração (em um ambiente de produção, use um logger mais robusto)
  logger.error(`[ERROR] ${new Date().toISOString()} - ${err.stack}`);

  // Monta a resposta de erro
  const errorResponse = {
    success: false,
    message: err.isOperational ? err.message : 'Ocorreu um erro inesperado no servidor.',
    // Em ambiente de desenvolvimento, pode ser útil enviar mais detalhes
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  };

  res.status(statusCode).json(errorResponse);
};
