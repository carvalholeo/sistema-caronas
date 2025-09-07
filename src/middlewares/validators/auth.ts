import { body } from 'express-validator';

export const registerValidator = [
  body('email').isEmail().withMessage('Formato de e-mail inválido.'),
  body('matricula').matches(/^[A-Z]/).withMessage('A matrícula deve iniciar com uma letra.'),
  body('password').isStrongPassword().withMessage('A senha não atende aos critérios de segurança.'),
  body('name').notEmpty().withMessage('O nome é obrigatório.'),
];

export const loginValidator = [
  body('email').isEmail().withMessage('Formato de e-mail inválido.'),
  body('password').notEmpty().withMessage('A senha é obrigatória.'),
];

export const twoFactorValidator = [
    body('code').isLength({ min: 6, max: 6 }).withMessage('O código 2FA deve ter 6 dígitos.'),
    body('token').notEmpty().withMessage('O token é obrigatório.')
];

export const requestResetValidator = [
  body('email', 'Por favor, forneça um e-mail válido.').isEmail().normalizeEmail(),
];

export const completeResetValidator = [
  body('token', 'O token é obrigatório.').notEmpty().isHexadecimal().isLength({ min: 64, max: 64 }),
  body('newPassword', 'A senha deve ter no mínimo 8 caracteres, incluindo letras e números.')
    .isLength({ min: 8 })
    .matches(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*?&]{8,}$/),
];
