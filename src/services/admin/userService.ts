// Lógica de negócio para todas as ações administrativas relacionadas a usuários.
import { Types } from 'mongoose';
import { UserModel } from 'models/user';
import { authService } from 'services/authService';
import { IUser } from 'types';
import { UserStatus, UserRole, AuditActionType, AuditLogCategory, AuditLogSeverityLevels, toAuditActionType } from 'types/enums/enums';
import { AuditLogModel } from 'models/auditLog';

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
      const is2FAValid = await authService.verifyTwoFactorCode(adminUser.twoFactorSecret, twoFactorCode);
      if (!is2FAValid) throw new Error('Código 2FA do administrador inválido.');
    }

    const auditEntry = new AuditLogModel({
      actor: {
        userId: adminUser._id,
        isAdmin: true,
        ip: '::1',
      },
      action: {
        actionType: toAuditActionType(status),
        category: AuditLogCategory.USER,
        detail: reason
      },
      target: {
        resourceType: UserModel.baseModelName,
        resourceId: targetUserId
      },
      metadata: {
        severity: AuditLogSeverityLevels.CRITICAL
      }
    });
    await auditEntry.save();

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

      const auditEntry = new AuditLogModel({
        actor: {
          userId: adminUser._id,
          isAdmin: true,
          ip: '::1',
        },
        action: {
          actionType: AuditActionType.TWO_FACTOR_REMOVED_BY_ADMIN,
          category: AuditLogCategory.USER,
          detail: reason
        },
        target: {
          resourceType: UserModel.baseModelName,
          resourceId: targetUserId
        },
        metadata: {
          severity: AuditLogSeverityLevels.CRITICAL
        }
      });
      await auditEntry.save();
    } else {
      if (!adminUser.permissions.includes('usuarios:editar')) throw new Error('Permissão insuficiente para editar usuário.');

      if (name) targetUser.name = name;
      if (email) targetUser.email = email;
      if (forcePasswordChange) targetUser.forcePasswordChangeOnNextLogin = true;

      const auditEntry = new AuditLogModel({
        actor: {
          userId: adminUser._id,
          isAdmin: true,
          ip: '::1',
        },
        action: {
          actionType: AuditActionType.USER_PROFILE_UPDATED_BY_ADMIN,
          category: AuditLogCategory.USER,
          detail: reason
        },
        target: {
          resourceType: UserModel.baseModelName,
          resourceId: targetUserId
        },
        metadata: {
          severity: AuditLogSeverityLevels.CRITICAL
        }
      });
      await auditEntry.save();
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

    const auditEntry = new AuditLogModel({
      actor: {
        userId: promoterAdmin._id,
        isAdmin: true,
        ip: '::1',
      },
      action: {
        actionType: AuditActionType.USER_PROMOTED_TO_ADMIN,
        category: AuditLogCategory.USER,
      },
      target: {
        resourceType: UserModel.baseModelName,
        resourceId: targetUserId
      },
      metadata: {
        severity: AuditLogSeverityLevels.CRITICAL
      }
    });
    await auditEntry.save();

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

    const auditEntry = new AuditLogModel({
      actor: {
        userId: adminUser._id,
        isAdmin: true,
        ip: '::1',
      },
      action: {
        actionType: AuditActionType.USER_DEMOTED_FROM_ADMIN,
        category: AuditLogCategory.USER,
        detail: reason
      },
      target: {
        resourceType: UserModel.baseModelName,
        resourceId: targetUserId
      },
      metadata: {
        severity: AuditLogSeverityLevels.CRITICAL
      }
    });
    await auditEntry.save();

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

    const auditEntry = new AuditLogModel({
      actor: {
        userId: adminUser._id,
        isAdmin: true,
        ip: '::1',
      },
      action: {
        actionType: AuditActionType.ADMIN_PERMISSIONS_UPDATED,
        category: AuditLogCategory.USER,
      },
      target: {
        resourceType: UserModel.baseModelName,
        resourceId: targetUserId,
        beforeState: oldPermissions,
        afterState: permissions
      },
      metadata: {
        severity: AuditLogSeverityLevels.CRITICAL,
      }
    });
    await auditEntry.save();

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
