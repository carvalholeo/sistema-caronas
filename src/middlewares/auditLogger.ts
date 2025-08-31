import { Request, Response, NextFunction } from 'express';
import {AuditLogModel as AuditLog} from '../models/auditLog';

const auditLogger = async (req: Request, res: Response, next: NextFunction) => {
    const { method, originalUrl, user } = req;
    const logEntry = new AuditLog({
        userId: user ? user.id : null,
        action: `${method} ${originalUrl}`,
        timestamp: new Date(),
    });

    try {
        await logEntry.save();
    } catch (error) {
        console.error('Error saving audit log:', error);
    }

    next();
};

export default auditLogger;