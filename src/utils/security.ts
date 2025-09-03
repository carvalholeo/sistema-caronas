import jwt, { SignOptions } from 'jsonwebtoken';
import authConfig from 'config/auth';
import { IUser } from 'types';

export const generateToken = (
    user: IUser,
    timeToExpire: any,
    otherOptions: SignOptions = {}
): string => {
    const payload = { id: user._id, email: user.email, role: user.roles };
    return jwt.sign(payload, authConfig.jwtSecret, {
        ...otherOptions,
        expiresIn: timeToExpire,
        notBefore: '0s',
    });
};

export const verifyToken = (token: string): Promise<any> => {
    return new Promise((resolve, reject) => {
        jwt.verify(token, authConfig.jwtSecret, (err, decoded) => {
            if (err) {
                return reject(err);
            }
            resolve(decoded);
        });
    });
};
