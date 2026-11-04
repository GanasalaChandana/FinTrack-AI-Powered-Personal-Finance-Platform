/** The message of a caught error, whatever was thrown. */
export function errorMessage(e: unknown): string | undefined {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return undefined;
}
