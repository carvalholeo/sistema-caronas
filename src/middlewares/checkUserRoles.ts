import { Request, Response, NextFunction } from 'express';
import { UserRole } from 'models/user';

const rbac = (roles: UserRole[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const userRole = req.user?.role; // Assuming req.user is populated with user info after authentication

        if (!userRole) {
            return res.status(403).json({ message: 'Access denied' });
        }

        if (roles.includes(userRole)) {
            return next();
        }

        return res.status(403).json({ message: 'Access denied' });
    };
};

export default rbac;