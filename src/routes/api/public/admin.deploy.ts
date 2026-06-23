// POST /api/public/admin/deploy
// Token-gated runtime bootstrap. See deploy-core.server.ts for the logic.

import { createFileRoute } from "@tanstack/react-router";

type DeployBody = { parties?: string[]; userId?: string };

export const Route = createFileRoute("/api/public/admin/deploy")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const adminToken = process.env.DEPLOY_ADMIN_TOKEN;
        if (!adminToken) {
          return Response.json(
            { error: "missing-config", missing: { DEPLOY_ADMIN_TOKEN: true } },
            { status: 500 },
          );
        }
        if (request.headers.get("x-deploy-token") !== adminToken) {
          return new Response("Unauthorized", { status: 401 });
        }
        let body: DeployBody = {};
        try {
          const text = await request.text();
          if (text.trim()) body = JSON.parse(text) as DeployBody;
        } catch {
          return Response.json({ error: "invalid-json" }, { status: 400 });
        }
        const { runDeploy } = await import("@/lib/canton/deploy-core.server");
        return await runDeploy({
          parties: body.parties,
          userId: body.userId,
          baseUrl: request.url,
        });
      },
    },
  },
});
