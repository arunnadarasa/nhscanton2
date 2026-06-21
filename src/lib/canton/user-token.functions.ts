// User-scoped Canton JWT minting. Returns a short-lived (5 min) RS256-signed
// token whose `sub` is the Daml user id `user-<supabaseUserId>`. The browser
// SHOULD NOT call Canton directly; instead, server fns that need to act as
// the signed-in user mint a token via mintCantonTokenForUser() inside their
// own handler. This serverFn is exposed for debugging / SDK-style flows that
// must call Canton from the client (rare).

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const mintCantonUserToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { mintCantonTokenForUser } = await import("./admin-token.server");
    const { token, expiresAt } = await mintCantonTokenForUser(context.userId);
    return { token, expiresAt };
  });
