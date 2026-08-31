"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/client/supabase";

type LinkStatus = "checking" | "valid" | "invalid";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [linkStatus, setLinkStatus] = useState<LinkStatus>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // By the time this page loads, /auth/confirm has already verified the
    // link server-side and set the session via cookies (or redirected here
    // with ?error= if it couldn't) — no token/code parsing needed here at
    // all, just check whether a session actually exists.
    if (new URLSearchParams(window.location.search).get("error")) {
      setLinkStatus("invalid");
      return;
    }
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      setLinkStatus(data.session ? "valid" : "invalid");
    });
  }, []);

  const handleSubmit = async () => {
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    const supabase = getSupabaseBrowserClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    router.push("/");
  };

  return (
    <section className="login-screen">
      <div className="login-card">
        <h1 style={{ margin: "0 0 8px" }}>Set your password</h1>

        {linkStatus === "checking" && <p style={{ color: "var(--muted)", fontWeight: 700 }}>Checking your link…</p>}

        {linkStatus === "invalid" && (
          <>
            <p style={{ color: "var(--danger)", fontWeight: 700 }}>
              This link is invalid or has expired. Ask an admin to resend an invite, or use &quot;Forgot password?&quot;
              on the login page.
            </p>
            <button className="btn primary" style={{ width: "100%", marginTop: 10 }} onClick={() => router.push("/")}>
              Back to login
            </button>
          </>
        )}

        {linkStatus === "valid" && (
          <>
            <p style={{ color: "var(--muted)", fontWeight: 700 }}>Choose a password for your account.</p>
            {error && <p style={{ color: "var(--danger)", fontWeight: 700 }}>{error}</p>}
            <div className="field" style={{ marginTop: 18 }}>
              <label>New password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <label>Confirm password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
            </div>
            <button className="btn primary" style={{ width: "100%", marginTop: 16 }} disabled={busy} onClick={handleSubmit}>
              Set password
            </button>
          </>
        )}
      </div>
    </section>
  );
}
