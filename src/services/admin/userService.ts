// Lógica de negócio para todas as ações administrativas relacionadas a usuários.
import { Types } from 'mongoose';
import { UserModel } from '../../models/user';
import { authService } from './../authService';
import { IUser} from 'types';
import { InternalAuditLogModel } from 'models/internalAuditLogSchema';
import { UserStatus, UserRole } from 'types/enums/enums';

class AdminUsersService {
  /**
   * Lista usuários com base em filtros.
   */
  public async listUsers(filters: any) {
    const filter: any = {};
    if (filters.status) {
      filter.status = filters.status;
    }
    if (filters.role) {
      filter.roles = filters.role;
    }
    return UserModel.find(filter).select('-password -twoFactorSecret');
  }

  /**
   * Atualiza o status de um usuário.
   */
  public async updateUserStatus(targetUserId: Types.ObjectId, adminUser: IUser, status: UserStatus, reason?: string, twoFactorCode?: string): Promise<IUser | null> {
    const targetUser = await UserModel.findById(targetUserId);
    if (!targetUser) throw new Error('Usuário alvo não encontrado.');

    const requiredPermissionMap: Partial<Record<UserStatus, string>> = {
      [UserStatus.Approved]: 'usuarios:aprovar',
      [UserStatus.Suspended]: 'usuarios:suspender',
      [UserStatus.Banned]: 'usuarios:banir',
      [UserStatus.Rejected]: 'usuarios:restaurar',
    };

    const requiredPermission = requiredPermissionMap[status];
    if (!requiredPermission || !adminUser.permissions.includes(requiredPermission)) {
      throw new Error('Permissão insuficiente para alterar para este status.');
    }

    if ([UserStatus.Suspended, UserStatus.Banned, UserStatus.Rejected].includes(status)) {
      if (!reason || !twoFactorCode) {
        throw new Error('Razão e código 2FA são obrigatórios para esta ação.');
      }
      const is2FAValid = await authService.verifyTwoFactorCode(adminUser._id.toString(), twoFactorCode);
      if (!is2FAValid) throw new Error('Código 2FA do administrador inválido.');
    }

    targetUser.status = status;
    const auditEntry = new InternalAuditLogModel({
      action: `status_changed_to_${status}`,
      adminUser: adminUser._id,
      timestamp: new Date(),
      reason: reason
    });
    targetUser.auditHistory.push(auditEntry);

    if (status === UserStatus.Suspended || status === UserStatus.Banned) {
      targetUser.sessionVersion = (targetUser.sessionVersion || 0) + 1;
    }

    await targetUser.save();
    return targetUser;
  }

  /**
   * Edita os dados de um usuário.
   */
  public async updateUser(targetUserId: Types.ObjectId, adminUser: IUser, updateData: any): Promise<IUser | null> {
    const { name, email, forcePasswordChange, disable2FA, reason, twoFactorCode } = updateData;
    const targetUser = await UserModel.findById(targetUserId);
    if (!targetUser) throw new Error('Usuário alvo não encontrado.');

    if (disable2FA) {
      if (!adminUser.permissions.includes('usuarios:remover_2fa')) throw new Error('Permissão insuficiente para remover 2FA.');
      if (!reason || !twoFactorCode) throw new Error('Razão e código 2FA são obrigatórios para desativar 2FA.');
      const is2FAValid = authService.verifyTwoFactorCode(adminUser._id.toString(), twoFactorCode);
      if (!is2FAValid) throw new Error('Código 2FA do administrador inválido.');

      if (!targetUser.twoFactorEnabled) throw new Error('O 2FA já está desativado para este usuário.');
      targetUser.twoFactorEnabled = false;
      targetUser.auditHistory.push(new InternalAuditLogModel({ action: '2fa_disabled_by_admin', adminUser: adminUser._id, timestamp: new Date(), reason }));
    } else {
      if (!adminUser.permissions.includes('usuarios:editar')) throw new Error('Permissão insuficiente para editar usuário.');

      if (name) targetUser.name = name;
      if (email) targetUser.email = email;
      if (forcePasswordChange) targetUser.forcePasswordChangeOnNextLogin = true;

      targetUser.auditHistory.push(new InternalAuditLogModel({ action: 'profile_edited_by_admin', adminUser: adminUser._id, timestamp: new Date() }));
    }

    targetUser.sessionVersion = (targetUser.sessionVersion || 0) + 1;
    await targetUser.save();
    return targetUser;
  }

  /**
   * Promove um usuário a administrador.
   */
  public async promoteToAdmin(targetUserId: Types.ObjectId, promoterAdmin: IUser, promoterTwoFactorCode: string): Promise<IUser | null> {
    const targetUser = await UserModel.findById(targetUserId);
    if (!targetUser) throw new Error('Usuário alvo não encontrado.');
    if (targetUser.roles.includes(UserRole.Admin)) throw new Error('Usuário já é um administrador.');
    if (!targetUser.twoFactorEnabled || !targetUser.twoFactorSecret) {
      throw new Error('Promoção recusada. O usuário precisa ter o 2FA ativo antes de ser promovido.');
    }

    const isPromoter2FAValid = await authService.verifyTwoFactorCode(promoterAdmin._id.toString(), promoterTwoFactorCode);
    if (!isPromoter2FAValid) throw new Error('Código 2FA do administrador inválido.');

    targetUser.roles.push(UserRole.Admin);
    targetUser.permissions = ['painel:acesso']; // Permissão base
    targetUser.sessionVersion = (targetUser.sessionVersion || 0) + 1;
    targetUser.auditHistory.push(new InternalAuditLogModel({ action: 'promoted_to_admin', adminUser: promoterAdmin._id, timestamp: new Date() }));

    await targetUser.save();
    return targetUser;
  }

  /**
   * Rebaixa um administrador para usuário comum.
   */
  public async demoteAdmin(targetUserId: Types.ObjectId, adminUser: IUser, reason: string, twoFactorCode: string): Promise<IUser | null> {
    const targetUser = await UserModel.findById(targetUserId);
    if (!targetUser || !targetUser.roles.includes(UserRole.Admin)) throw new Error('Administrador alvo não encontrado.');

    const is2FAValid = await authService.verifyTwoFactorCode(adminUser.twoFactorSecret, twoFactorCode);
    if (!is2FAValid) throw new Error('Código 2FA do administrador inválido.');

    targetUser.roles = targetUser.roles.filter(role => role !== UserRole.Admin);
    targetUser.permissions = [];
    targetUser.sessionVersion = (targetUser.sessionVersion || 0) + 1;
    targetUser.auditHistory.push(new InternalAuditLogModel({ action: 'demoted_from_admin', adminUser: adminUser._id, timestamp: new Date(), reason }));

    await targetUser.save();
    return targetUser;
  }

  /**
   * Atualiza as permissões de um administrador.
   */
  public async updateAdminPermissions(targetUserId: Types.ObjectId, adminUser: IUser, permissions: string[]): Promise<IUser | null> {
    const targetUser = await UserModel.findById(targetUserId);
    if (!targetUser || !targetUser.roles.includes(UserRole.Admin)) throw new Error('Administrador alvo não encontrado.');

    // // Valida se as permissões existem
    // permissions.forEach(p => {
    //     if (!AllPermissions.includes(p)) throw new Error(`Permissão inválida: ${p}`);
    // });

    const oldPermissions = targetUser.permissions;
    targetUser.permissions = permissions;
    targetUser.sessionVersion += 1;
    targetUser.auditHistory.push(new InternalAuditLogModel({
      action: 'admin_permissions_updated',
      adminUser: adminUser._id,
      details: { from: oldPermissions, to: permissions }
    }));


    await targetUser.save();
    return targetUser;
  }

  /**
   * Obtém as permissões de um administrador.
   */
  public async getAdminPermissions(targetUserId: Types.ObjectId): Promise<{ permissions: string[] }> {
    const targetUser = await UserModel.findById(targetUserId).select('permissions roles');
    if (!targetUser) {
      throw new Error('Usuário não encontrado.');
    }
    if (!targetUser.roles.includes(UserRole.Admin)) {
      throw new Error('Este usuário não é um administrador.');
    }
    return { permissions: targetUser.permissions };
  }
}

export const adminUsersService = new AdminUsersService();
