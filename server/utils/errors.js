export class AppError extends Error {
  constructor(kind, message, status = 400, fieldErrors = null) {
    super(message);
    this.name = 'AppError';
    this.kind = kind;
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Please correct the highlighted fields.', fieldErrors = null) {
    super('validation', message, 422, fieldErrors);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Please sign in again.') {
    super('unauthenticated', message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action.') {
    super('forbidden', message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(what = 'Record') {
    super('not_found', `${what} not found.`, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Operation conflict.') {
    super('conflict', message, 409);
  }
}
