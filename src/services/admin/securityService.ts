// Lógica de negócio para o painel de segurança.
import { BlockModel } from '../../models/block';
import { UserModel } from '../../models/user';
import { AuditLogModel } from '../../models/auditLog';
import { authService } from '../authService';
import { Types } from 'mongoose';
import { IBlock, IUser } from 'types';
import { AuditActionType, AuditLogCategory, AuditLogSeverityLevels } from 'types/enums/enums';

class AdminSecurityService {
  public async listAllBlocks(): Promise<IBlock[]> {
    return BlockModel.find({ status: 'active' }).populate('blockerUser blockedUser', 'name email');
  }

  public async getBlockDetails(blockId: Types.ObjectId, adminUser: IUser, twoFactorCode: string): Promise<IBlock | null> {
    if (!authService.verifyTwoFactorCode(adminUser.twoFactorSecret, twoFactorCode)) throw new Error("Código 2FA inválido.");

    const block = await BlockModel.findById(blockId);
    if (block) {
      const auditEntry = new AuditLogModel({
        actor: {
          userId: adminUser._id,
          isAdmin: true,
          ip: '::1',
        },
        action: {
          actionType: AuditActionType.SECURITY_BLOCK_REASONS_VIEWED_BY_ADMIN,
          category: AuditLogCategory.SECURITY,
        },
        target: {
          resourceType: 'block',
          resourceId: blockId
        },
        metadata: {
          severity: AuditLogSeverityLevels.CRITICAL
        }
      });
      await auditEntry.save();
    }
    return block;
  }

  public async forceGlobalLogout(targetUserId: Types.ObjectId, adminUser: IUser, twoFactorCode: string): Promise<{ message: string }> {
    if (!authService.verifyTwoFactorCode(adminUser.twoFactorSecret, twoFactorCode)) throw new Error("Código 2FA inválido.");

    const targetUser = await UserModel.findById(targetUserId);
    if (!targetUser) throw new Error("Usuário não encontrado.");

    targetUser.sessionVersion += 1;
    targetUser.forcePasswordChangeOnNextLogin = true;
    await targetUser.save();

    const auditEntry = new AuditLogModel({
        actor: {
          userId: adminUser._id,
          isAdmin: true,
          ip: '::1',
        },
        action: {
          actionType: AuditActionType.SECURITY_USER_SESSIONS_REVOKED_BY_ADMIN,
          category: AuditLogCategory.SECURITY,
        },
        target: {
          resourceType: 'user',
          resourceId: targetUserId
        },
        metadata: {
          severity: AuditLogSeverityLevels.CRITICAL
        }
      });
      await auditEntry.save();

    return { message: "Todas as sessões do usuário foram revogadas." };
  }
}

export const adminSecurityService = new AdminSecurityService();
