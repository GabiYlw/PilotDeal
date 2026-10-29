// pgvector accepts a vector as text like "[0.1,-0.2,3e-7]" (exponent notation included).
// Repositories pass this string as ONE bound parameter and cast it with ::vector in SQL.
export function toVectorLiteral(vector: readonly number[]): string {
  if (!vector.every(Number.isFinite)) {
    throw new Error("Vector contains a non-finite value");
  }
  return `[${vector.join(",")}]`;
}
