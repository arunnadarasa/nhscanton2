import { useEffect, useState } from "react";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery, useMutation } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { ChevronDown, LogIn, LogOut, Menu } from "lucide-react";


import { getLedgerMode } from "@/lib/nhs/canton.functions";
import { setCantonNetwork } from "@/lib/canton/network.functions";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export const ledgerModeQuery = queryOptions({
  queryKey: ["canton", "mode"],
  queryFn: () => getLedgerMode(),
  staleTime: 30_000,
});

type NetworkAlias = "fly" | "seaport" | "memory";
function networkAlias(n: "memory" | "localnet" | "devnet" | undefined): NetworkAlias {
  if (n === "localnet") return "fly";
  if (n === "devnet") return "seaport";
  return "memory";
}


const NAV_LINKS = [
  { to: "/allocations", label: "Allocations" },
  { to: "/icb/LDN", label: "ICB cockpit" },
  { to: "/trust/GSTT", label: "Trust view" },
  { to: "/contracts/new", label: "Create contract" },
  { to: "/audit", label: "Audit" },
  { to: "/ledger", label: "Ledger" },
  { to: "/canton-vs-evm", label: "Why Canton" },
  { to: "/deploy", label: "Deploy" },
  { to: "/how-it-works", label: "How it's built" },
  { to: "/hackathon", label: "Hackathon" },
  { to: "/deck", label: "Pitch deck" },
] as const;

type NavGroupItem = { to: string; label: string; description?: string };
const NAV_GROUPS: Array<{ label: string; width: string; items: NavGroupItem[] }> = [
  {
    label: "Cockpits",
    width: "w-64",
    items: [
      { to: "/allocations", label: "Allocations", description: "Budget distribution across ICBs" },
      { to: "/icb/LDN", label: "ICB cockpit", description: "Integrated Care Board operations" },
      { to: "/trust/GSTT", label: "Trust view", description: "Provider and facility performance" },
    ],
  },
  {
    label: "Ledger",
    width: "w-72",
    items: [
      { to: "/ledger", label: "Ledger", description: "Immutable transaction record" },
      { to: "/audit", label: "Audit", description: "Compliance & governance stream" },
      { to: "/contracts/new", label: "Create contract", description: "Submit a new Daml contract" },
    ],
  },
  {
    label: "About",
    width: "w-64",
    items: [
      { to: "/canton-vs-evm", label: "Why Canton" },
      { to: "/how-it-works", label: "How it's built" },
      { to: "/deploy", label: "Deploy" },
      { to: "/hackathon", label: "Hackathon" },
      { to: "/deck", label: "Pitch deck" },
    ],
  },
];


export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: mode } = useSuspenseQuery(ledgerModeQuery);
  const live = mode.mode === "live";
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const router = useRouter();

  const currentAlias = networkAlias(mode.network);
  const available = mode.available ?? { memory: true, fly: false, seaport: false };

  const switchNetwork = useMutation({
    mutationFn: (alias: NetworkAlias) => setCantonNetwork({ data: alias }),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      await router.invalidate();
    },
  });


  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user.email ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      {/* Ambient brand glow — sets the premium WOW tone */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-40 right-[-10%] h-[480px] w-[480px] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute top-[40%] left-[-10%] h-[420px] w-[420px] rounded-full bg-accent/15 blur-[120px]" />
      </div>

      {/* Floating glass nav */}
      <header className="sticky top-3 z-50 mx-auto w-full max-w-7xl px-2.5 md:top-6 md:px-6">
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-2xl border border-white/60 bg-white/70 px-2.5 py-2 shadow-soft backdrop-blur-xl md:flex md:justify-between md:gap-6 md:px-5 md:py-3">
          <div className="flex min-w-0 items-center gap-1.5 md:gap-2">

            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  aria-label="Open navigation"
                  className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-white/60 text-muted-foreground transition hover:bg-secondary hover:text-foreground md:hidden"
                >
                  <Menu className="h-5 w-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <SheetHeader className="border-b border-border px-5 py-4 text-left">
                  <SheetTitle className="leading-tight">
                    <div className="font-display text-base font-bold tracking-tight text-primary">
                      NHS Ledger
                    </div>
                    <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      on Canton Network
                    </div>
                  </SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col p-2">
                  {NAV_LINKS.map((n) => (
                    <Link
                      key={n.to}
                      to={n.to}
                      onClick={() => setOpen(false)}
                      className="rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition hover:bg-secondary hover:text-primary"
                      activeProps={{
                        className:
                          "rounded-lg px-3 py-2.5 text-sm bg-secondary text-primary font-semibold",
                      }}
                    >
                      {n.label}
                    </Link>
                  ))}
                </nav>
                <div className="mt-2 border-t border-border p-3">
                  {email ? (
                    <>
                      <div className="mb-2 px-1 text-[11px] font-medium text-muted-foreground truncate">
                        Signed in as {email}
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          setOpen(false);
                          await handleSignOut();
                        }}
                        className="block w-full rounded-lg border border-border bg-white px-3 py-2.5 text-center text-sm font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                      >
                        Sign out
                      </button>
                    </>
                  ) : (
                    <Link
                      to="/auth"
                      onClick={() => setOpen(false)}
                      className="block w-full rounded-lg border border-primary/30 bg-primary/10 px-3 py-2.5 text-center text-sm font-semibold text-primary transition hover:bg-primary hover:text-primary-foreground"
                    >
                      Sign in
                    </Link>
                  )}
                </div>
              </SheetContent>
            </Sheet>

            <Link to="/" className="flex min-w-0 items-center gap-2 md:gap-2.5">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground font-display font-bold shadow-glow">
                ₵
              </div>
              <div className="hidden min-w-0 leading-none [@media(min-width:380px)]:block">
                <div className="truncate font-display text-sm font-bold tracking-tight text-primary">
                  NHS Ledger
                </div>
                <div className="mt-0.5 hidden text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground sm:block">
                  on Canton Network
                </div>
              </div>
            </Link>

          </div>

          <nav className="hidden min-w-0 items-center gap-1 text-sm font-medium md:flex">
            {NAV_GROUPS.map((group) => (
              <NavGroup key={group.label} group={group} />
            ))}
          </nav>


          <div className="flex min-w-0 items-center justify-center md:hidden">
            <NetworkToggle
              current={currentAlias}
              available={available}
              live={live}
              endpoint={mode.endpoint}
              pending={switchNetwork.isPending}
              onSelect={(alias) => {
                if (alias === currentAlias) return;
                switchNetwork.mutate(alias);
              }}
            />
          </div>

          <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
            <div className="hidden md:flex md:items-center md:gap-2">
              <Link
                to="/contracts/new"
                className="rounded-lg border border-border bg-white/70 px-3 py-1.5 text-[12px] font-semibold text-muted-foreground transition hover:bg-secondary hover:text-primary"
              >
                Create contract
              </Link>
              <Link
                to="/deploy"
                className="rounded-lg bg-primary px-3.5 py-1.5 text-[12px] font-semibold text-primary-foreground shadow-glow transition hover:opacity-90"
              >
                Deploy
              </Link>
              <div className="mx-1 h-6 w-px bg-border" />
              <NetworkToggle
                current={currentAlias}
                available={available}
                live={live}
                endpoint={mode.endpoint}
                pending={switchNetwork.isPending}
                onSelect={(alias) => {
                  if (alias === currentAlias) return;
                  switchNetwork.mutate(alias);
                }}
              />
            </div>


            {email ? (
              <button
                type="button"
                onClick={handleSignOut}
                aria-label="Sign out"
                title={email}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-white/60 text-muted-foreground transition hover:bg-secondary hover:text-foreground sm:h-auto sm:w-auto sm:px-3 sm:py-1 sm:text-[11px] sm:font-semibold"
              >
                <LogOut className="h-4 w-4 sm:hidden" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            ) : (
              <Link
                to="/auth"
                aria-label="Sign in"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary transition hover:bg-primary hover:text-primary-foreground sm:h-auto sm:w-auto sm:px-3 sm:py-1 sm:text-[11px] sm:font-semibold"
              >
                <LogIn className="h-4 w-4 sm:hidden" />
                <span className="hidden sm:inline">Sign in</span>
              </Link>
            )}
          </div>

        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-8 md:px-6 md:pt-12">
        {children}
      </main>

      <footer className="mx-auto mt-12 max-w-7xl border-t border-border px-4 py-8 text-center text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground md:px-6">
        Built on Canton Network 3.4 · Daml templates in{" "}
        <code className="font-mono text-primary">daml/Nhs.daml</code> · Talks JSON
        Ledger API v2 directly via fetch
      </footer>
    </div>
  );
}

const TOGGLE_OPTIONS: Array<{
  alias: NetworkAlias;
  label: string;
  short: string;
  envHint: string;
}> = [
  { alias: "memory", label: "Memo", short: "M", envHint: "Always available (in-process demo ledger)" },
  { alias: "seaport", label: "Devnet", short: "D", envHint: "Set CANTON_DEVNET_JSON_API_URL + CANTON_DEVNET_OIDC_* secrets" },
];


function NetworkToggle({
  current,
  available,
  live,
  endpoint,
  pending,
  onSelect,
}: {
  current: NetworkAlias;
  available: { memory: true; fly: boolean; seaport: boolean };
  live: boolean;
  endpoint?: string;
  pending: boolean;
  onSelect: (alias: NetworkAlias) => void;
}) {
  return (
    <div
      className="flex items-center gap-1 rounded-full border border-border bg-white/60 p-0.5 shadow-sm backdrop-blur-sm"
      role="radiogroup"
      aria-label="Canton network"
    >
      {TOGGLE_OPTIONS.map((opt) => {
        const isActive = opt.alias === current;
        const isAvailable = available[opt.alias];
        const isLiveActive = isActive && live && opt.alias !== "memory";
        return (
          <button
            key={opt.alias}
            type="button"
            role="radio"
            aria-checked={isActive}
            disabled={!isAvailable || pending}
            onClick={() => onSelect(opt.alias)}
            title={
              !isAvailable
                ? `${opt.label} not configured — ${opt.envHint}`
                : isActive
                  ? endpoint ?? opt.label
                  : `Switch to ${opt.label}`
            }
            className={`relative inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition ${
              !isAvailable
                ? "cursor-not-allowed text-gray-300 opacity-50 grayscale"
                : isActive
                  ? isLiveActive
                    ? "bg-emerald-500 text-white shadow-sm ring-2 ring-emerald-500/30"
                    : "bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/30"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            {isActive ? (
              <span
                className={`h-1.5 w-1.5 rounded-full bg-white ${
                  isLiveActive ? "animate-pulse" : ""
                }`}
              />
            ) : null}
            <span className="hidden sm:inline">{opt.label}</span>
            <span className="sm:hidden">{opt.short}</span>
          </button>
        );
      })}
    </div>
  );
}

