import { describe, it, expect } from 'vitest';
import {
  AppError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
} from '../errors.js';

describe('errors', () => {
  describe('AppError', () => {
    it('sets statusCode and message', () => {
      const error = new AppError(500, 'Something went wrong');
      expect(error.statusCode).toBe(500);
      expect(error.message).toBe('Something went wrong');
    });

    it('has name "AppError"', () => {
      const error = new AppError(500, 'test');
      expect(error.name).toBe('AppError');
    });

    it('is an instance of Error', () => {
      const error = new AppError(500, 'test');
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('UnauthorizedError', () => {
    it('sets statusCode to 401', () => {
      const error = new UnauthorizedError();
      expect(error.statusCode).toBe(401);
    });

    it('has default message "Unauthorized"', () => {
      const error = new UnauthorizedError();
      expect(error.message).toBe('Unauthorized');
    });

    it('allows custom message', () => {
      const error = new UnauthorizedError('Custom unauthorized');
      expect(error.message).toBe('Custom unauthorized');
    });

    it('has name "UnauthorizedError"', () => {
      const error = new UnauthorizedError();
      expect(error.name).toBe('UnauthorizedError');
    });

    it('is an instance of AppError and Error', () => {
      const error = new UnauthorizedError();
      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('ForbiddenError', () => {
    it('sets statusCode to 403 with default message "Forbidden"', () => {
      const error = new ForbiddenError();
      expect(error.statusCode).toBe(403);
      expect(error.message).toBe('Forbidden');
    });

    it('allows custom message', () => {
      const error = new ForbiddenError('Access denied');
      expect(error.message).toBe('Access denied');
    });

    it('has name "ForbiddenError" and is instanceof AppError', () => {
      const error = new ForbiddenError();
      expect(error.name).toBe('ForbiddenError');
      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('NotFoundError', () => {
    it('sets statusCode to 404 with default message "Not Found"', () => {
      const error = new NotFoundError();
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('Not Found');
    });

    it('allows custom message', () => {
      const error = new NotFoundError('Resource missing');
      expect(error.message).toBe('Resource missing');
    });

    it('has name "NotFoundError" and is instanceof AppError', () => {
      const error = new NotFoundError();
      expect(error.name).toBe('NotFoundError');
      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('ConflictError', () => {
    it('sets statusCode to 409 with default message "Conflict"', () => {
      const error = new ConflictError();
      expect(error.statusCode).toBe(409);
      expect(error.message).toBe('Conflict');
    });

    it('allows custom message', () => {
      const error = new ConflictError('Duplicate entry');
      expect(error.message).toBe('Duplicate entry');
    });

    it('has name "ConflictError" and is instanceof AppError', () => {
      const error = new ConflictError();
      expect(error.name).toBe('ConflictError');
      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('ValidationError', () => {
    it('sets statusCode to 400 with default message "Validation Error"', () => {
      const error = new ValidationError();
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Validation Error');
    });

    it('allows custom message', () => {
      const error = new ValidationError('Invalid input');
      expect(error.message).toBe('Invalid input');
    });

    it('has name "ValidationError" and is instanceof AppError', () => {
      const error = new ValidationError();
      expect(error.name).toBe('ValidationError');
      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(Error);
    });
  });
});
