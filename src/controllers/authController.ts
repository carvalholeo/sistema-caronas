import { Request, Response } from 'express';
import { authService } from 'services/authService';
import qrcode from 'qrcode';
import authConfig from 'config/auth';
import * as security from 'utils/security';
import { UserModel } from 'models/user';
import { IUser } from 'types';

class AuthController {
    public async register(req: Request, res: Response): Promise<Response> {
        try {
            await authService.register(req.body);
            return res.status(201).json({ message: "Cadastro realizado com sucesso. Aguardando aprovação." });
        } catch (error: Error | any) {
            return res.status(409).json({ message: error.message });
        }
    }

    public async login(req: Request, res: Response): Promise<Response> {
        try {
            const ipAddress = req.ip;
            const device = req.headers['user-agent'] || 'unknown';
            const result = await authService.login(req.body, ipAddress, device);
            return res.status(200).json(result);
        } catch (error: Error | any) {
            return res.status(401).json({ message: error.message });
        }
    }

    public async generate2FA(req: Request, res: Response): Promise<Response> {
        try {
            const { secret, otpauth_url } = authService.generateTwoFactorSecret();
            const user = req.user!;
            user.twoFactorSecret = secret;
            await user.save();

            qrcode.toDataURL(otpauth_url, (err, data_url) => {
                if (err) throw err;
                return res.status(200).json({ secret, qrCodeUrl: data_url });
            });
            return res.status(200);
        } catch (error: Error | any) {
            return res.status(500).json({ message: 'Erro ao gerar segredo 2FA.', error: error.message });
        }
    }

    public async verify2FA(req: Request, res: Response): Promise<Response> {
        try {
            const { token: tempToken, code } = req.body;
            const decoded: any = security.verifyToken(tempToken);
            if (!decoded.twoFactorRequired) throw new Error("Token inválido para verificação 2FA.");

            const user = await UserModel.findById(decoded.id).select('+twoFactorSecret');
            if (!user || !user.twoFactorSecret) throw new Error("Usuário não encontrado ou 2FA não configurado.");

            const isValid = authService.verifyTwoFactorCode(user.twoFactorSecret, code);
            if (!isValid) return res.status(401).json({ message: "Código 2FA inválido." });

            const payload = { id: user._id, permissions: user.permissions, sessionVersion: user.sessionVersion };
            const token = security.generateToken(payload as IUser, authConfig.jwtExpiration);

            return res.status(200).json({ token });
        } catch (error: Error | any) {
            return res.status(401).json({ message: error.message });
        }
    }

    /**
     * Lida com a requisição para iniciar a redefinição de senha.
     */
    public async requestReset(req: Request, res: Response): Promise<Response> {
        try {
            const { email } = req.body;
            await authService.initiateReset(email);

            // Sempre retorne uma mensagem genérica para evitar enumeração de usuários
            return res.status(200).json({ message: 'Se um usuário com este e-mail existir, um link de redefinição de senha foi enviado.' });
        } catch (error: any) {
            return res.status(500).json({ message: 'Erro interno ao processar a solicitação.', error: error.message });
        }
    }

    /**
     * Lida com a requisição para concluir a redefinição de senha.
     */
    public async completeReset(req: Request, res: Response): Promise<Response> {
        try {
            const { token, newPassword } = req.body;
            await authService.completeReset(token, newPassword);
            return res.status(200).json({ message: 'Senha redefinida com sucesso.' });
        } catch (error: any) {
            // Retorne uma mensagem genérica para tokens inválidos
            return res.status(400).json({ message: error.message });
        }
    }
}

export const authController = new AuthController();

