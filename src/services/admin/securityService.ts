// Lógica de negócio para o painel de segurança.
import { BlockModel, IBlock } from '../../models/block';
import { IUser, UserModel } from '../../models/user';
import { AuditLogModel } from '../../models/auditLog';
import { authService } from '../authService';
import { SessionEventModel } from '../../models/sessionEvent';
import { Types } from 'mongoose';

class AdminSecurityService {
  public async listAllBlocks(): Promise<IBlock[]> {
    return BlockModel.find({ status: 'active' }).populate('blockerUser blockedUser', 'name email');
  }

  public async getBlockDetails(blockId: Types.ObjectId, adminUser: IUser, twoFactorCode: string): Promise<IBlock | null> {
    if (!authService.verifyTwoFactorCode(adminUser.twoFactorSecret, twoFactorCode)) throw new Error("Código 2FA inválido.");

    const block = await BlockModel.findById(blockId);
    if (block) {
      await new AuditLogModel({ adminUser: adminUser._id, action: 'seguranca:ver_motivos', target: { type: 'block', id: blockId } }).save();
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

    await new SessionEventModel({ user: targetUserId, type: 'global_logout_admin', adminUser: adminUser._id }).save();
    await new AuditLogModel({ adminUser: adminUser._id, action: 'seguranca:forcar_logout', target: { type: 'user', id: targetUserId } }).save();

    return { message: "Todas as sessões do usuário foram revogadas." };
  }
}

export const adminSecurityService = new AdminSecurityService();
