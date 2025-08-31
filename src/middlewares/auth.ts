import { Request, Response, NextFunction } from 'express';
import { UserModel } from '../models/user';
import { verifyToken } from 'utils/security';

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Acesso negado. Nenhum token fornecido.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded: any = verifyToken(token);
    const user = await UserModel.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ message: 'Usuário não encontrado.' });
    }

    // Validação da versão da sessão para logout global
    if (decoded.sessionVersion !== user.sessionVersion) {
        return res.status(401).json({ message: 'Sua sessão expirou. Por favor, faça login novamente.' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token inválido.' });
  }
};
