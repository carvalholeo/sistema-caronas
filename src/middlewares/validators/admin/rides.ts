import { body, param } from 'express-validator';

export const adminEditRideValidator = [
    param('id').isMongoId().withMessage('ID da carona inválido.'),
    body('reason').notEmpty().withMessage('A razão para a edição é obrigatória.')
];

export const adminCancelRideValidator = [
    param('id').isMongoId().withMessage('ID da carona inválido.'),
    body('reason').notEmpty().withMessage('A razão para o cancelamento é obrigatória.')
];

export const adminForcePublishValidator = [
    param('id').isMongoId().withMessage('ID da carona inválido.'),
    body('reason').notEmpty().withMessage('A razão para forçar a publicação é obrigatória.')
];
