/** Generate a random v4 UUID using the Web Crypto API. */
export function generateUuid(): string {
  return crypto.randomUUID();
}
