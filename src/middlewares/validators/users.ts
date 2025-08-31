import { body } from "express-validator";


export const userUpdateValidator = [
  body('email')
    .optional()
    .isEmail()
    .withMessage('Please provide a valid email address.'),
  body('name')
    .optional()
    .notEmpty()
    .withMessage('Name cannot be empty.'),
];