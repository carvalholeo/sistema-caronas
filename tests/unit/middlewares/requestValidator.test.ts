
import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { requestValidator } from '../../../src/middlewares/requestValidator';

// Mock express-validator
jest.mock('express-validator');

const mockedValidationResult = validationResult as jest.Mock;

describe('Request Validator Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    mockedValidationResult.mockClear();
  });

  it('should call next() if there are no validation errors', () => {
    mockedValidationResult.mockImplementation(() => ({
      isEmpty: () => true,
    }));

    requestValidator(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should return 400 with errors if validation fails', () => {
    const mockErrors = [{ msg: 'Invalid email' }, { msg: 'Password too short' }];
    mockedValidationResult.mockImplementation(() => ({
      isEmpty: () => false,
      array: () => mockErrors,
    }));

    requestValidator(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ errors: mockErrors });
    expect(next).not.toHaveBeenCalled();
  });
});
