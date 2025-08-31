import { body, param } from 'express-validator';

export const readChatValidator = [
    param('rideId').isMongoId(),
    param('user1Id').isMongoId(),
    param('user2Id').isMongoId(),
];

export const moderateMessageValidator = [
    param('messageId').isMongoId(),
    body('reason').notEmpty().withMessage('A razão da moderação é obrigatória.'),
];

export const exportChatValidator = [
    param('rideId').isMongoId(),
    param('user1Id').isMongoId(),
    param('user2Id').isMongoId(),
    body('twoFactorCode').isLength({ min: 6, max: 6 }).withMessage('O código 2FA é obrigatório.'),
];
