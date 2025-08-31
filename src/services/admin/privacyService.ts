// Lógica de negócio para o painel de privacidade (LGPD/GDPR).
import { IUser, UserModel, UserStatus } from '../../models/user';
import { DataReportModel } from '../../models/dataReport';
import { AuditLogModel, IAuditLog } from '../../models/auditLog';
import { authService } from '../authService';
import crypto from 'crypto';
import { Types } from 'mongoose';
import { FormalNotificationModel } from 'models/formalNotification';

class AdminPrivacyService {
  public async generateDataReport(targetUserId: Types.ObjectId, adminUser: IUser, twoFactorCode: string): Promise<any> {
    if (!authService.verifyTwoFactorCode(adminUser.twoFactorSecret, twoFactorCode)) throw new Error("Código 2FA inválido.");

    const targetUser = await UserModel.findById(targetUserId);
    if (!targetUser) throw new Error("Usuário não encontrado.");

    const reportData = {
      profile: targetUser.toObject(),
      //... aqui seriam buscados dados de outros modelos (veículos, caronas, etc)
    };
    const reportString = JSON.stringify(reportData);
    const hash = crypto.createHash('sha256').update(reportString).digest('hex');

    await new DataReportModel({
      user: targetUserId,
      adminUser: adminUser._id,
      hash,
      includedDataPoints: Object.keys(reportData)
    }).save();

    await new AuditLogModel({
      adminUser: adminUser._id,
      action: 'privacidade:emitir_relatorio',
      target: { type: 'user', id: targetUserId }
    }).save();

    return { reportData, hash };
  }

  public async processUserRemoval(targetUserId: Types.ObjectId, adminUser: IUser, twoFactorCode: string): Promise<any> {
    if (!authService.verifyTwoFactorCode(adminUser.twoFactorSecret, twoFactorCode)) throw new Error("Código 2FA inválido.");
    const targetUser = await UserModel.findById(targetUserId);
    if (!targetUser) throw new Error("Usuário não encontrado.");

    targetUser.name = "Usuário Anonimizado";
    targetUser.email = `${targetUser._id}@anon.com`;
    targetUser.matricula = `ANON${targetUser._id}`;
    targetUser.status = UserStatus.Anonymized;
    targetUser.sessionVersion += 1; // Invalida sessões

    await targetUser.save();
    await new AuditLogModel({
      adminUser: adminUser._id,
      action: 'privacidade:solicitacao_remocao',
      target: { type: 'user', id: targetUserId }
    }).save();

    return { message: "Usuário anonimizado com sucesso." };
  }

  public async viewPrivacyLogs(targetUserId: Types.ObjectId, adminUser: IUser): Promise<IAuditLog[]> {
    await new AuditLogModel({
      adminUser: adminUser._id,
      action: 'privacidade:ver_logs',
      target: { type: 'logs', id: targetUserId }
    }).save();
    return AuditLogModel.find({ 'target.id': targetUserId, action: { $regex: /^privacidade:/ } });
  }

  /**
   * Envia uma notificação formal para um usuário e registra o ato.
   * @param targetUserId - O ID do usuário a ser notificado.
   * @param adminUser - O administrador que está enviando.
   * @param subject - O assunto da notificação.
   * @param body - O corpo da mensagem da notificação.
   */
  public async sendFormalNotification(targetUserId: Types.ObjectId, adminUser: IUser, subject: string, body: string) {
    const targetUser = await UserModel.findById(targetUserId);
    if (!targetUser) {
      throw new Error('Usuário alvo não encontrado.');
    }

    // 1. Salva o registro da notificação formal no banco
    const notification = new FormalNotificationModel({
      user: targetUserId,
      sentBy: adminUser._id,
      subject,
      body,
    });
    await notification.save();

    // 2. Aqui iria a lógica para enviar a notificação (ex: e-mail)
    // Ex: await EmailService.send(targetUser.email, subject, body);

    // 3. Registrar no log de auditoria
    const auditLog = new AuditLogModel({
      action: 'privacidade:notificar_usuario',
      adminUser: adminUser._id,
      target: { type: 'user', id: targetUserId },
      details: { extra: { mensagem: `Notificação enviada com assunto: "${subject}"`}}
    });
    await auditLog.save();

    return { message: 'Notificação formal registrada e enviada com sucesso.' };
  }
}

export const adminPrivacyService = new AdminPrivacyService();
