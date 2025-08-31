import { body, param } from 'express-validator';

export const blockDetailsValidator = [
    param('blockId').isMongoId(),
    body('twoFactorCode').isLength({ min: 6, max: 6 }).withMessage('O código 2FA é obrigatório.'),
];

export const forceLogoutValidator = [
    param('targetUserId').isMongoId(),
    body('twoFactorCode').isLength({ min: 6, max: 6 }).withMessage('O código 2FA é obrigatório.'),
];
