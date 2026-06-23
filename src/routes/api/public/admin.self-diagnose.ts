// GET /api/public/admin/self-diagnose
// Same as /admin/diagnose but uses the server-side DEPLOY_ADMIN_TOKEN
// so operators can hit it from the browser/CI without pasting the token.
// Forwards the canton_network cookie so network selection works.

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/admin/self-diagnose")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = process.env.DEPLOY_ADMIN_TOKEN;
        if (!token) {
          return Response.json({ error: "DEPLOY_ADMIN_TOKEN not set" }, { status: 500 });
        }
        const url = new URL("/api/public/admin/diagnose", request.url).toString();
        const cookie = request.headers.get("cookie") ?? "";
        const res = await fetch(url, {
          method: "GET",
          headers: {
            "x-deploy-token": token,
            ...(cookie ? { cookie } : {}),
          },
        });
        const text = await res.text();
        return new Response(text, {
          status: res.status,
          headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
        });
      },
    },
  },
});
