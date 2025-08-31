import { Request, Response, NextFunction } from 'express';
import { AccessDenialLogModel } from '../models/denialLog';

export const checkPermission = (requiredPermission: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Autenticação necessária.' });
    }

    const hasPermission = req.user.permissions.includes(requiredPermission);

    if (hasPermission) {
      return next();
    } else {
      // Registra a tentativa de acesso negado
      await new AccessDenialLogModel({
        adminUser: req.user._id,
        requiredPermission,
        attemptedAction: `${req.method} ${req.originalUrl}`,
        target: { params: req.params, body: req.body }
      }).save();

      return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para realizar esta ação.' });
    }
  };
};
