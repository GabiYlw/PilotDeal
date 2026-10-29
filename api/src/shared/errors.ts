export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: string;

  constructor(
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  readonly statusCode = 400;
  readonly code = "VALIDATION_ERROR";
}

export class NotFoundError extends AppError {
  readonly statusCode = 404;
  readonly code = "NOT_FOUND";
}

export class DealClosedError extends AppError {
  readonly statusCode = 409;
  readonly code = "DEAL_CLOSED";
}

export class EmbeddingUnavailableError extends AppError {
  readonly statusCode = 503;
  readonly code = "EMBEDDING_UNAVAILABLE";
}
