import { Request, Response, NextFunction } from 'express';
import {AuditLogModel as AuditLog} from '../models/auditLog';

const auditLogger = async (req: Request, res: Response, next: NextFunction) => {
    const { method, originalUrl, user } = req;
    const logEntry = new AuditLog({
        adminUser: user ? user.id : null,
        action: `${method} ${originalUrl}`,
        details: {
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'] || 'Unknown',
            extra: {
                body: req.body,
                query: req.query,
                params: req.params
            }
        },
        target: {
            type: 'Request',
            id: ''
        }
    });

    try {
        await logEntry.save();
    } catch (error) {
        console.error('Error saving audit log:', error);
    }

    next();
};

export default auditLogger;