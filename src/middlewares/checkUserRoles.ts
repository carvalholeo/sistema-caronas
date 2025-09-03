import { Request, Response, NextFunction } from 'express';
import { UserRole } from 'types/enums/enums';

const rbac = (roles: UserRole[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const userRole = req.user?.roles; // Assuming req.user is populated with user info after authentication

        if (!userRole) {
            return res.status(403).json({ message: 'Access denied' });
        }

        if (userRole.some(role => roles.includes(role))) {
            return next();
        }

        return res.status(403).json({ message: 'Access denied' });
    };
};

export default rbac;