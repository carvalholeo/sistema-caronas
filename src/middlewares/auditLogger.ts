import { Request, Response, NextFunction } from 'express';
import { AuditLogModel } from 'models/auditLog';
import { AuditActionType, AuditLogCategory, AuditLogSeverityLevels, UserRole } from 'types/enums/enums';
import logger from 'utils/logger';

const auditLogger = async (req: Request, res: Response, next: NextFunction) => {
    const { method, originalUrl, user } = req;

    const auditEntry = new AuditLogModel({
        actor: {
            userId: user?._id || null,
            isAdmin: user?.roles.includes(UserRole.Admin) || false,
            ip: req.ip,
            userAgent: req.headers['user-agent'] || 'Unknown'
        },
        action: {
            actionType: AuditActionType.REQUEST_LOG,
            category: AuditLogCategory.SYSTEM,
        },
        target: {
            resourceType: 'Request',
            resourceId: ''
        },
        metadata: {
            severity: AuditLogSeverityLevels.INFO,
            extra: {
                body: req.body,
                query: req.query,
                params: req.params,
                method,
                originalUrl
            }
        }
    });

    try {
        await auditEntry.save();
    } catch (error) {
        logger.error('Error saving audit log:', error);
    }

    next();
};

export default auditLogger;