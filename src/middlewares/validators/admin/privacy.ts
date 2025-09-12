import { body, param } from 'express-validator';

export const privacyActionValidator = [
    param('targetUserId').isMongoId().withMessage('ID de usuário inválido.'),
    body('twoFactorCode').isLength({ min: 6, max: 6 }).withMessage('O código 2FA é obrigatório para esta ação.'),
];

export const verifyReportValidator = [
    param('hash').isLength({ min: 64, max: 64 }).withMessage('Hash de verificação inválido.'),
];
