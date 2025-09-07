import { UserModel } from 'models/user';
import speakeasy from 'speakeasy';
import { LoginAttemptModel } from 'models/loginAttempt';
import authConfig from 'config/auth';
import { generateToken } from 'utils/security';
import { IUser } from 'types';
import { UserRole, UserStatus } from 'types/enums/enums';
import { Types } from 'mongoose';

class AuthService {
    async register(userData: any): Promise<IUser> {
        const { email, matricula, password, name } = userData;
        const existingUser = await UserModel.findOne({ $or: [{ email }, { matricula }] });

        if (existingUser) {
            throw new Error('E-mail ou matrícula já cadastrado.');
        }

        const user = new UserModel({ email, matricula, password, name, roles: [UserRole.Caroneiro] });
        await user.save();
        return user;
    }

    public async login(credentials: any, ipAddress: string | undefined, device: string): Promise<any> {
        const { email, password } = credentials;
        const user = await UserModel.findOne({ email }).select('+password +twoFactorSecret');
        const attempt = new LoginAttemptModel({ email, ipAddress, device, wasSuccessful: false });

        if (!user || !user.password) {
            await attempt.save();
            throw new Error('Credenciais inválidas.');
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            await attempt.save();
            throw new Error('Credenciais inválidas.');
        }

        if (user.status !== UserStatus.Approved) {
            throw new Error(`Acesso negado. Status da conta: ${user.status}`);
        }

        attempt.wasSuccessful = true;
        attempt.user = user._id as unknown as Types.ObjectId;
        await attempt.save();

        user.lastLogin = new Date();
        await user.save();

        if (user.twoFactorSecret) {
            const tempToken = generateToken({ id: user._id, twoFactorRequired: true } as unknown as IUser, authConfig.jwt2FAExpiration);
            return { twoFactorRequired: true, tempToken };
        }

        const payload = { id: user._id, permissions: user.permissions, sessionVersion: user.sessionVersion };
        const token = generateToken(payload as IUser, authConfig.jwtExpiration);

        return { token, user: { id: user._id, name: user.name, email: user.email, roles: user.roles } };
    }

    public generateTwoFactorSecret(): { secret: string; otpauth_url: string } {
        const secret = speakeasy.generateSecret({ length: 20, name: 'Carona Legal' });
        return {
            secret: secret.base32,
            otpauth_url: secret.otpauth_url!
        };
    }

    public verifyTwoFactorCode(secret: string, code: string): boolean {
        return speakeasy.totp.verify({
            secret: secret,
            encoding: 'base32',
            token: code,
            window: 1
        });
    }
}

export const authService = new AuthService();