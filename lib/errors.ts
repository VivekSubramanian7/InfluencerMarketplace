const GENERIC = "Something went wrong — please try again.";

export function friendlyDbError(
  error: { code?: string; message?: string } | null,
  fallbacks: Record<string, string> = {}
): string {
  if (!error) return GENERIC;
  if (error.code && fallbacks[error.code]) return fallbacks[error.code];
  // P0001 = plpgsql RAISE EXCEPTION: our own intentional business copy
  if (error.code === "P0001" && error.message) return error.message;
  return GENERIC;
}
