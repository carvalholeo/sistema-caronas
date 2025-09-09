import { UserModel } from 'models/user';
import speakeasy from 'speakeasy';
import { LoginAttemptModel } from 'models/loginAttempt';
import authConfig from 'config/auth';
import { generateToken } from 'utils/security';
import { INotificationPayload, IUser } from 'types';
import { PasswordResetStatus, UserRole, UserStatus } from 'types/enums/enums';
import crypto from 'crypto';
import { PasswordResetModel } from 'models/passwordReset';
import notificationService from './notificationService';
import { emailService } from './emailService';
import { EmailTemplate } from 'types/enums/email';

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
        attempt.user = user as unknown as IUser;
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

    /**
   * Inicia o processo de redefinição de senha para um usuário.
   * @param email - O e-mail do usuário.
   */
    public async initiateReset(email: string): Promise<void> {
        const user = await UserModel.findOne({ email });

        // Para evitar ataques de enumeração de usuários, não retorne um erro se o usuário não for encontrado.
        // Apenas prossiga se o usuário existir e estiver em um status ativo.
        if (user && user.status === 'approved') {
            const rawToken = crypto.randomBytes(32).toString('hex');
            const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

            // O token expira em 15 minutos
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

            await new PasswordResetModel({
                user: user._id,
                tokenHash,
                expiresAt,
            }).save();

            // Lógica de envio de e-mail
            const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${rawToken}`;
            const userToSend = user as unknown as IUser;

            const emailBody = await emailService.prepareEmailTemplate(
                EmailTemplate.PasswordResetRequest,
                {
                    userName: user.name,
                    resetLink
                }
            );

            const notificationContent: INotificationPayload = {
              category: 'system',
              title: 'Solicitação de reset de senha',
              body: emailBody
            };
            notificationService.sendNotification([userToSend], notificationContent);
        }
    }

    /**
     * Conclui o processo de redefinição de senha.
     * @param token - O token bruto recebido pelo usuário.
     * @param newPassword - A nova senha fornecida pelo usuário.
     */
    public async completeReset(token: string, newPassword: string): Promise<void> {
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        const resetRequest = await PasswordResetModel.findOne({
            tokenHash,
            status: PasswordResetStatus.INITIATED, // Garante que o token não foi usado
            expiresAt: { $gt: new Date() }, // Garante que o token não expirou
        });

        if (!resetRequest) {
            throw new Error('Token de redefinição inválido ou expirado.');
        }

        const user = await UserModel.findById(resetRequest.user);
        if (!user) {
            throw new Error('Usuário não encontrado.');
        }

        // Atualiza a senha do usuário
        user.password = newPassword;
        await user.save();

        // Marca a solicitação como concluída
        resetRequest.status = PasswordResetStatus.COMPLETED;
        await resetRequest.save();
    }
}

export const authService = new AuthService();