// The commit this deployment was built from (Vercel sets VERCEL_GIT_COMMIT_SHA).
// CI waits for it to match the pushed commit before running the E2E tests.
export const dynamic = "force-static";

export function GET() {
  return Response.json({ version: process.env.VERCEL_GIT_COMMIT_SHA || "dev" });
}
