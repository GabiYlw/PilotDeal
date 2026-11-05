import type { ErrorRequestHandler, RequestHandler } from "express";
import { AppError, NotFoundError } from "./errors.js";

export interface ErrorBody {
  error: { code: string; message: string; details?: unknown };
}

function toErrorBody(code: string, message: string, details?: unknown): ErrorBody {
  return { error: details === undefined ? { code, message } : { code, message, details } };
}

// express.json() throws this when the request body is not valid JSON.
function isMalformedJsonError(error: unknown): boolean {
  return error instanceof SyntaxError && "type" in error && error.type === "entity.parse.failed";
}

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(`Route ${req.method} ${req.path} not found`));
};

export const errorMiddleware: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (error instanceof AppError) {
    res.status(error.statusCode).json(toErrorBody(error.code, error.message, error.details));
    return;
  }

  if (isMalformedJsonError(error)) {
    res.status(400).json(toErrorBody("VALIDATION_ERROR", "Request body is not valid JSON"));
    return;
  }

  console.error(error);
  res.status(500).json(toErrorBody("INTERNAL_ERROR", "Internal server error"));
};
