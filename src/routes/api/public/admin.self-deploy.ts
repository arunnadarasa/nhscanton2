// TEMP one-shot: runs the deploy logic in-process using the server-side
// DEPLOY_ADMIN_TOKEN so the operator does not need to paste it. Avoids a
// Worker-to-self HTTP loopback (which 502s in production).

import { createFileRoute } from "@tanstack/react-router";

type DeployBody = { parties?: string[]; userId?: string };

export const Route = createFileRoute("/api/public/admin/self-deploy")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env.DEPLOY_ADMIN_TOKEN;
        if (!token) {
          return Response.json({ error: "DEPLOY_ADMIN_TOKEN not set" }, { status: 500 });
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
