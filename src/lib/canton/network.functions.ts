// Server fn for the header toggle that flips which Canton participant the
// app talks to. Writes the `canton_network` cookie; subsequent loaders /
// server fns pick up the new value via currentCantonNetwork().

import { createServerFn } from "@tanstack/react-start";
import { setCookie, deleteCookie } from "@tanstack/react-start/server";
import { z } from "zod";

const NetworkAliasSchema = z.enum(["fly", "seaport", "memory"]);

export const setCantonNetwork = createServerFn({ method: "POST" })
  .inputValidator((input) => NetworkAliasSchema.parse(input))
  .handler(async ({ data }) => {
    setCookie("canton_network", data, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
      httpOnly: false,
    });
    return { network: data };
  });

export const clearCantonNetwork = createServerFn({ method: "POST" }).handler(async () => {
  deleteCookie("canton_network", { path: "/" });
  return { ok: true };
});
