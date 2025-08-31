import { query } from 'express-validator';

export const dateRangeValidator = [
  query('startDate').isISO8601().toDate().withMessage('Data de início inválida.'),
  query('endDate').isISO8601().toDate().withMessage('Data de fim inválida.'),
];

export const singleDateValidator = [
  query('endDate').isISO8601().toDate().withMessage('Data de fim inválida.'),
];
