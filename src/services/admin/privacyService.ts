// Lógica de negócio para o painel de privacidade (LGPD/GDPR).
import { UserModel } from 'models/user';
import { DataReportModel } from 'models/dataReport';
import { AuditLogModel } from 'models/auditLog';
import { authService } from 'services/authService';
import crypto from 'crypto';
import { Types } from 'mongoose';
import { IAuditLog, IUser } from 'types';
import { AuditActionType, AuditLogCategory, AuditLogSeverityLevels, NotificationScope, UserStatus } from 'types/enums/enums';
import { NotificationEventModel } from 'models/event';

interface IReportData {
  profile: object;
  // Outros dados relacionados (veículos, caronas, etc) poderiam ser adicionados aqui
}

interface IReport {
  reportData: IReportData;
  hash: string;
}

class AdminPrivacyService {
  public async generateDataReport(targetUserId: Types.ObjectId, adminUser: IUser, twoFactorCode: string): Promise<IReport> {
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

    const auditEntry = new AuditLogModel({
      actor: {
        userId: adminUser._id,
        isAdmin: true,
        ip: '::1',
      },
      action: {
        actionType: AuditActionType.PRIVACY_DATA_REPORT_GENERATED,
        category: AuditLogCategory.PRIVACY
      },
      target: {
        resourceType: UserModel.baseModelName,
        resourceId: targetUserId
      },
      metadata: {
        severity: AuditLogSeverityLevels.INFO
      }
    });
    await auditEntry.save();

    return { reportData, hash };
  }

  public async processUserRemoval(targetUserId: Types.ObjectId, adminUser: IUser, twoFactorCode: string): Promise<{ message: string }> {
    if (!authService.verifyTwoFactorCode(adminUser.twoFactorSecret, twoFactorCode)) throw new Error("Código 2FA inválido.");
    const targetUser = await UserModel.findById(targetUserId);
    if (!targetUser) throw new Error("Usuário não encontrado.");

    targetUser.name = "Usuário Anonimizado";
    targetUser.email = `${targetUser._id}@anon.com`;
    targetUser.matricula = `ANON${targetUser._id}`;
    targetUser.status = UserStatus.Anonymized;
    targetUser.sessionVersion += 1; // Invalida sessões

    await targetUser.save();

    const auditEntry = new AuditLogModel({
      actor: {
        userId: adminUser._id,
        isAdmin: true,
        ip: '::1',
      },
      action: {
        actionType: AuditActionType.PRIVACY_USER_REMOVAL_PROCESSED,
        category: AuditLogCategory.PRIVACY
      },
      target: {
        resourceType: UserModel.baseModelName,
        resourceId: targetUserId
      },
      metadata: {
        severity: AuditLogSeverityLevels.INFO
      }
    });
    await auditEntry.save();

    return { message: "Usuário anonimizado com sucesso." };
  }

  public async viewPrivacyLogs(targetUserId: Types.ObjectId, adminUser: IUser): Promise<IAuditLog[]> {
    const auditEntry = new AuditLogModel({
      actor: {
        userId: adminUser._id,
        isAdmin: true,
        ip: '::1',
      },
      action: {
        actionType: AuditActionType.PRIVACY_LOGS_VIEWED_BY_ADMIN,
        category: AuditLogCategory.PRIVACY
      },
      target: {
        resourceType: UserModel.baseModelName,
        resourceId: targetUserId
      },
      metadata: {
        severity: AuditLogSeverityLevels.WARN
      }
    });
    await auditEntry.save();
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

    const notification = new NotificationEventModel({
      scope: NotificationScope.Privacy,
      user: targetUser._id,
      category: 'system',
      statusHistory: [{
        status: 'sent',
        timestamp: new Date(),
        details: ''
      }],
      payload: JSON.stringify({ title: subject, body }),
      isAggregated: false,
      isCritical: true
    });
    await notification.save();

    const auditEntry = new AuditLogModel({
      actor: {
        userId: adminUser._id,
        isAdmin: true,
        ip: '::1',
      },
      action: {
        actionType: AuditActionType.PRIVACY_FORMAL_NOTIFICATION_SENT,
        category: AuditLogCategory.PRIVACY
      },
      target: {
        resourceType: UserModel.baseModelName,
        resourceId: targetUserId
      },
      metadata: {
        severity: AuditLogSeverityLevels.INFO,
        extra: {
          mensagem: `Notificação enviada com assunto: "${subject}"`
        }
      }
    });
    await auditEntry.save();

    return { message: 'Notificação formal registrada e enviada com sucesso.' };
  }
}

export const adminPrivacyService = new AdminPrivacyService();
