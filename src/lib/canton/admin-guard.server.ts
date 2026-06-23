// Shared admin-token guard for the temp /api/public/admin/* routes.
// Bypasses Lovable's public-route auth by living under /api/public/*, so each
// handler MUST gate itself. Caller provides `x-deploy-token` matching
// process.env.DEPLOY_ADMIN_TOKEN. Returns null when authorized, else a 401/500
// Response the route should return directly.

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function requireDeployToken(request: Request): Response | null {
  const expected = process.env.DEPLOY_ADMIN_TOKEN;
  if (!expected) {
    return Response.json(
      { error: "missing-config", missing: { DEPLOY_ADMIN_TOKEN: true } },
      { status: 500 },
    );
  }
  const provided = request.headers.get("x-deploy-token") ?? "";
  if (!provided || !timingSafeEqual(provided, expected)) {
    return new Response("Unauthorized", { status: 401 });
  }
  return null;
}
