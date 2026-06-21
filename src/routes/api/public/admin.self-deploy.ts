// TEMP one-shot: triggers /api/public/admin/deploy using the server-side
// DEPLOY_ADMIN_TOKEN so the operator does not need to paste it. Safe to
// delete after the live ledger has been initialised.

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/admin/self-deploy")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env.DEPLOY_ADMIN_TOKEN;
        if (!token) {
          return Response.json({ error: "DEPLOY_ADMIN_TOKEN not set" }, { status: 500 });
        }
        const url = new URL("/api/public/admin/deploy", request.url).toString();
        const res = await fetch(url, {
          method: "POST",
          headers: { "x-deploy-token": token, "Content-Type": "application/json" },
          body: "{}",
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
