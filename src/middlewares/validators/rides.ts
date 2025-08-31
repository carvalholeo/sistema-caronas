import { body, param } from 'express-validator';

export const rideValidator = [
  body('vehicle').isMongoId().withMessage('ID de veículo inválido.'),
  body('origin.location').isString().notEmpty(),
  body('origin.point.coordinates').isArray({ min: 2, max: 2 }),
  body('destination.location').isString().notEmpty(),
  body('destination.point.coordinates').isArray({ min: 2, max: 2 }),
  body('departureTime').isISO8601().toDate().withMessage('Data e hora de partida inválidas.'),
  body('availableSeats').isInt({ min: 1 }).withMessage('Pelo menos um assento deve estar disponível.'),
  body('price').isFloat({ min: 0 }).withMessage('O preço deve ser um valor numérico.'),
];

export const recurrentRideValidator = [
  ...rideValidator,
  body('recurrence').notEmpty().withMessage('As regras de recorrência são obrigatórias.'),
  body('recurrence.daysOfWeek').isArray({ min: 1 }).withMessage('Pelo menos um dia da semana deve ser selecionado.'),
  body('recurrence.endDate').isISO8601().toDate().withMessage('A data final da recorrência é inválida.'),
];

export const manageSeatValidator = [
  param('id').isMongoId().withMessage('ID da carona inválido.'),
  body('passengerId').isMongoId().withMessage('ID do passageiro inválido.'),
  body('action').isIn(['approve', 'reject']).withMessage('Ação inválida.'),
];
