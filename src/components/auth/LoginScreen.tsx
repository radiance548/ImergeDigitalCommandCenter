"use client";

import Image from "next/image";
import { useState } from "react";
import { useAppStore } from "@/store/useAppStore";

export default function LoginScreen() {
  const login = useAppStore((s) => s.login);
  const requestPasswordReset = useAppStore((s) => s.requestPasswordReset);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotNotice, setForgotNotice] = useState<string | null>(null);
  const [forgotBusy, setForgotBusy] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      setError("Enter both email and password.");
      return;
    }
    setBusy(true);
    const result = await login(email, password);
    setBusy(false);
    if (!result.ok) setError(result.message || "Login failed.");
  };

  const handleForgotSubmit = async () => {
    if (!forgotEmail) return;
    setForgotBusy(true);
    const result = await requestPasswordReset(forgotEmail);
    setForgotBusy(false);
    setForgotNotice(result.message || "If that email has an account, a reset link was sent.");
  };

  return (
    <section className="login-screen">
      <div className="login-card">
        <div className="login-logo">
          <Image src="/logo-icon.png" alt="" width={73} height={61} priority />
        </div>
        <h1 style={{ margin: "14px 0 8px" }}>Imerge Command Center</h1>
        <p style={{ color: "var(--muted)", fontWeight: 700 }}>Login with your authorized staff account.</p>
        {error && <p style={{ color: "var(--danger)", fontWeight: 700 }}>{error}</p>}
        <div className="field" style={{ marginTop: 18 }}>
          <label>Email</label>
          <input type="email" placeholder="name@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <label>Password</label>
          <input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          />
        </div>
        <button className="btn primary" style={{ width: "100%", marginTop: 16 }} disabled={busy} onClick={handleLogin}>
          Login
        </button>

        {!showForgot ? (
          <button
            className="btn"
            style={{ width: "100%", marginTop: 10, background: "transparent", border: 0 }}
            onClick={() => setShowForgot(true)}
          >
            Forgot password?
          </button>
        ) : (
          <div className="field" style={{ marginTop: 14 }}>
            <label>Enter your email to reset your password</label>
            {forgotNotice ? (
              <p style={{ color: "var(--success)", fontWeight: 700 }}>{forgotNotice}</p>
            ) : (
              <>
                <input
                  type="email"
                  placeholder="name@gmail.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleForgotSubmit()}
                />
                <button className="btn" style={{ width: "100%", marginTop: 10 }} disabled={forgotBusy} onClick={handleForgotSubmit}>
                  Send reset link
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
