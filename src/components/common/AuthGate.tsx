import { useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, LoaderCircle, LogIn, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/common/GlassCard";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import { connectCloudSync, disconnectCloudSync } from "@/features/sync/cloudSync";

export function AuthGate({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) {
      setLoading(false);
      return;
    }

    let alive = true;
    client.auth.getSession().then(({ data, error }) => {
      if (!alive) return;
      if (error) setErrorMessage(error.message);
      setSession(data.session);
      setLoading(false);
    });

    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    const params = new URLSearchParams(window.location.hash.slice(1));
    const authError = params.get("error_description");
    if (authError) {
      setErrorMessage(authError.replaceAll("+", " "));
      window.history.replaceState(
        {},
        document.title,
        window.location.pathname + window.location.search,
      );
    }

    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const continueWithGoogle = async () => {
    const client = getSupabaseClient();
    if (!client) return;

    setBusy(true);
    setErrorMessage("");
    const { error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });

    if (error) {
      setErrorMessage(error.message);
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="surface-gradient flex min-h-dvh items-center justify-center px-5">
        <div className="flex items-center gap-3 text-sm text-muted-foreground" role="status">
          <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
          Checking your Ledge account…
        </div>
      </div>
    );
  }

  if (configured && session)
    return <SignedInDataGate userId={session.user.id}>{children}</SignedInDataGate>;

  return (
    <main className="surface-gradient relative flex min-h-dvh items-center justify-center overflow-hidden px-5 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--primary)_0%,_transparent_48%)] opacity-[0.12]" />
      <GlassCard strong className="relative w-full max-w-md p-7 sm:p-9">
        <div className="mx-auto flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-primary/15 ring-1 ring-primary/30">
          <img src="/icon.svg" alt="" className="h-10 w-10" />
        </div>

        <div className="mt-5 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Ledge</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            Your money, in sync.
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
            Sign in to continue to your personal lending, repayments, and chitti records.
          </p>
        </div>

        <div className="mt-7 space-y-3">
          {configured ? (
            <Button
              className="h-11 w-full rounded-xl text-sm"
              disabled={busy}
              onClick={continueWithGoogle}
            >
              {busy ? <LoaderCircle className="animate-spin" /> : <LogIn />}
              Continue with Google
              {!busy && <ArrowRight className="ml-auto" />}
            </Button>
          ) : (
            <div className="rounded-xl border border-border bg-secondary/40 p-3 text-sm text-muted-foreground">
              Google sign-in is not configured for this deployment yet.
            </div>
          )}

          {errorMessage && (
            <p
              className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
              role="alert"
            >
              {errorMessage}
            </p>
          )}
        </div>

        <div className="mt-6 flex items-start gap-2.5 border-t border-border/60 pt-5 text-xs leading-5 text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p>
            Your records are private to your account. Sign in securely with Google to open Ledge.
          </p>
        </div>
      </GlassCard>
    </main>
  );
}

function SignedInDataGate({ userId, children }: { userId: string; children: ReactNode }) {
  const queryClient = useQueryClient();
  const [readyUserId, setReadyUserId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setReadyUserId(null);
    queryClient.clear();

    void connectCloudSync(userId, () => {
      void queryClient.invalidateQueries();
    })
      .then((stop) => {
        if (active) setReadyUserId(userId);
        else stop();
      })
      .catch((error: unknown) => {
        if (active) setReadyUserId(userId);
        console.error("Could not initialize Ledge cloud sync", error);
      });

    return () => {
      active = false;
      disconnectCloudSync();
      queryClient.clear();
    };
  }, [queryClient, userId]);

  if (readyUserId !== userId) {
    return (
      <div className="surface-gradient flex min-h-dvh items-center justify-center px-5">
        <div className="flex items-center gap-3 text-sm text-muted-foreground" role="status">
          <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
          Loading your private Ledge data…
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
