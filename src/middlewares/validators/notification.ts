import { body, param } from 'express-validator';

export const subscribeValidator = [
  body('deviceIdentifier').isString().notEmpty().withMessage('O identificador do dispositivo é obrigatório.'),
  body('platform').isIn(['web', 'ios', 'android', 'email']).withMessage('A plataforma especificada é inválida.'),
  body('endpoint').optional().isURL().withMessage('O endpoint deve ser uma URL válida (para plataforma web).'),
  body('keys').optional().isObject().withMessage('As chaves devem ser um objeto (para plataforma web).'),
  body('deviceToken').optional().isString().withMessage('O token do dispositivo deve ser uma string (para ios/android).'),
  body('emailAddress').optional().isEmail().withMessage('O endereço de e-mail é inválido (para plataforma email).'),
];

export const updatePreferencesValidator = [
  param('deviceIdentifier').isString().notEmpty().withMessage('O identificador do dispositivo é obrigatório na URL.'),
  body('kinds').optional().isObject().withMessage('O campo "kinds" deve ser um objeto.'),
  body('kinds.*').optional().isBoolean().withMessage('Todos os valores em "kinds" devem ser booleanos.'),
  body('quietHours').optional({ nullable: true }).isObject().withMessage('O campo "quietHours" deve ser um objeto ou nulo.'),
  body('quietHours.startHour').if(body('quietHours').exists({ checkNull: true })).isInt({ min: 0, max: 23 }).withMessage('A hora de início deve ser entre 0 e 23.'),
  body('quietHours.endHour').if(body('quietHours').exists({ checkNull: true })).isInt({ min: 0, max: 23 }).withMessage('A hora de fim deve ser entre 0 e 23.'),
  body('quietHours.weekDays').if(body('quietHours').exists({ checkNull: true })).isArray().withMessage('Os dias da semana devem ser um array.'),
  body('quietHours.weekDays.*').if(body('quietHours').exists({ checkNull: true })).isInt({ min: 0, max: 6 }).withMessage('Cada dia da semana deve ser um número entre 0 e 6.'),
  body('quietHours.timezone').if(body('quietHours').exists({ checkNull: true })).isString().notEmpty().withMessage('O fuso horário é obrigatório.'),
];
