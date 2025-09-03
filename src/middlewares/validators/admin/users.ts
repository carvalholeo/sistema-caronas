import { body, param } from 'express-validator';
import { UserStatus } from 'types/enums/enums';

export const updateUserStatusValidator = [
    param('targetUserId').isMongoId().withMessage('ID de usuário inválido.'),
    body('status').isIn(Object.values(UserStatus)).withMessage('Status inválido.'),
    body('reason').if(body('status').isIn([UserStatus.Banned, UserStatus.Suspended, UserStatus.Rejected])).notEmpty().withMessage('A razão é obrigatória para esta ação.'),
    body('twoFactorCode').if(body('status').isIn([UserStatus.Banned, UserStatus.Suspended, UserStatus.Anonymized])).isLength({ min: 6, max: 6 }).withMessage('O código 2FA é obrigatório para esta ação.'),
];

export const updateUserValidator = [
    param('targetUserId').isMongoId().withMessage('ID de usuário inválido.'),
    body('disableTwoFactor').optional().isBoolean(),
    body('reason').if(body('disableTwoFactor').equals('true')).notEmpty().withMessage('A razão é obrigatória para desativar o 2FA.'),
    body('twoFactorCode').if(body('disableTwoFactor').equals('true')).isLength({ min: 6, max: 6 }).withMessage('O seu código 2FA é obrigatório para esta ação.'),
];

export const promoteAdminValidator = [
    param('targetUserId').isMongoId().withMessage('ID de usuário inválido.'),
    body('twoFactorCode').isLength({ min: 6, max: 6 }).withMessage('O seu código 2FA é obrigatório.'),
];

export const demoteAdminValidator = [
    param('targetUserId').isMongoId().withMessage('ID de usuário inválido.'),
    body('reason').notEmpty().withMessage('A razão é obrigatória.'),
    body('twoFactorCode').isLength({ min: 6, max: 6 }).withMessage('O seu código 2FA é obrigatório.'),
];

export const permissionsValidator = [
    param('targetUserId').isMongoId().withMessage('ID de usuário inválido.'),
    body('permissions').isArray().withMessage('Permissões devem ser uma lista.'),
];
