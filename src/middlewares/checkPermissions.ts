import { Request, Response, NextFunction } from 'express';
import { AuditLogModel } from 'models/auditLog';
import { AuditActionType, AuditLogCategory, AuditLogSeverityLevels, UserRole } from 'types/enums/enums';

export function checkPermission(requiredPermission: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Autenticação necessária.' });
    }

    const hasPermission = req.user.permissions.includes(requiredPermission);

    if (hasPermission) {
      return next();
    }

    const auditEntry = new AuditLogModel({
      actor: {
        userId: req.user?._id || null,
        isAdmin: req.user?.roles.includes(UserRole.Admin) || false,
        ip: req.ip,
        userAgent: req.headers['user-agent'] || 'Unknown'
      },
      action: {
        actionType: AuditActionType.SECURITY_ACCESS_DENIED,
        category: AuditLogCategory.SECURITY,
      },
      target: {
        resourceType: 'Request',
        resourceId: ''
      },
      metadata: {
        severity: AuditLogSeverityLevels.CRITICAL,
        extra: {
          body: req.body,
          query: req.query,
          params: req.params,
          method: req.method,
          originalUrl: req.originalUrl
        }
      }
    });

    await auditEntry.save();

    return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para realizar esta ação.' });
  };
}

export function checkPermissions(requiredPermissions: string[]) {
  for (const permission of requiredPermissions) {
    if (typeof permission !== 'string') {
      throw new Error('Permissões devem ser strings.');
    }

    checkPermission(permission);
  }
}