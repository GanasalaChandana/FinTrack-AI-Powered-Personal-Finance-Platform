/** Pages anyone can open without signing in (one list for the whole app). */
export const PUBLIC_PATHS = [
  "/", "/login", "/register", "/signin", "/signup", "/auth",
  "/forgot-password", "/reset-password", "/two-factor-recovery",
];

export function isPublicPath(path: string | null | undefined): boolean {
  if (!path) return true;
  return PUBLIC_PATHS.includes(path) ||
    PUBLIC_PATHS.some((p) => p !== "/" && (path.startsWith(`${p}/`) || path.startsWith(`${p}?`)));
}
