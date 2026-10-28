import { Prisma } from "../../generated/prisma/client.js";

function hasCode(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

// P2025: the record to update or delete does not exist.
export function isRecordNotFoundError(error: unknown): boolean {
  return hasCode(error, "P2025");
}

// P2003: a foreign key points to a row that does not exist.
export function isForeignKeyViolation(error: unknown): boolean {
  return hasCode(error, "P2003");
}
