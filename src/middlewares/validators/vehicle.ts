import { body } from 'express-validator';

export const vehicleValidator = [
  body('plate').isString().notEmpty().withMessage('A placa é obrigatória.'),
  body('make').isString().notEmpty().withMessage('A marca é obrigatória.'),
  body('model').isString().notEmpty().withMessage('O modelo é obrigatório.'),
  body('year').isInt({ min: 1980 }).withMessage('O ano deve ser um número válido.'),
  body('color').isString().notEmpty().withMessage('A cor é obrigatória.'),
  body('capacity').isInt({ min: 1 }).withMessage('A capacidade deve ser de no mínimo 1.'),
];
