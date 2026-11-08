import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Cloud, LogIn, LogOut, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/common/GlassCard";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

export function CloudAccountCard() {
  const configured = isSupabaseConfigured();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) {
      setLoading(false);
      return;
    }

    let alive = true;
    client.auth.getSession().then(({ data, error }) => {
      if (!alive) return;
      if (error) toast.error(error.message);
      setSession(data.session);
      setLoading(false);
    });

    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const signIn = async () => {
    const client = getSupabaseClient();
    if (!client) return;
    setBusy(true);
    const { error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      toast.error(error.message);
      setBusy(false);
    }
  };

  const signOut = async () => {
    const client = getSupabaseClient();
    if (!client) return;
    setBusy(true);
    const { error } = await client.auth.signOut();
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Signed out of your Ledge account");
  };

  return (
    <GlassCard className="space-y-3 p-4">
      <div className="flex items-center gap-2">
        <Cloud className="h-5 w-5 text-primary" />
        <span className="text-sm font-semibold">Ledge account</span>
      </div>

      {!configured ? (
        <>
          <p className="text-xs text-muted-foreground">
            Add the Supabase project URL and publishable key to enable Google sign-in.
          </p>
          <Button variant="outline" size="sm" disabled>
            <LogIn className="mr-2 h-4 w-4" /> Continue with Google
          </Button>
        </>
      ) : loading ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <LoaderCircle className="h-4 w-4 animate-spin" /> Checking account…
        </p>
      ) : session ? (
        <>
          <p className="text-xs text-muted-foreground">
            Signed in as <span className="font-medium text-foreground">{session.user.email}</span>
          </p>
          <Button variant="outline" size="sm" disabled={busy} onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Sign in once to connect your Ledge account. Cloud record sync is the next implementation phase;
            existing records remain on this device for now.
          </p>
          <Button size="sm" disabled={busy} onClick={signIn}>
            {busy ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
            Continue with Google
          </Button>
        </>
      )}
    </GlassCard>
  );
}
