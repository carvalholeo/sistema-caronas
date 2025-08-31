import { NextFunction, Request, Response } from "express";
import { body, validationResult } from "express-validator";

const validateUserRegistration = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address.'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long.'),
  body('name')
    .notEmpty()
    .withMessage('Name is required.'),
];

const validateUserUpdate = [
  body('email')
    .optional()
    .isEmail()
    .withMessage('Please provide a valid email address.'),
  body('name')
    .optional()
    .notEmpty()
    .withMessage('Name cannot be empty.'),
];

const validateRideCreation = [
  body('origin')
    .notEmpty()
    .withMessage('Origin is required.'),
  body('destination')
    .notEmpty()
    .withMessage('Destination is required.'),
  body('date')
    .isISO8601()
    .withMessage('Date must be a valid ISO 8601 date.'),
];

const validateChatMessage = [
  body('message')
    .notEmpty()
    .withMessage('Message cannot be empty.'),
];

const validate = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

export {
  validateUserRegistration,
  validateUserUpdate,
  validateRideCreation,
  validateChatMessage,
  validate,
};