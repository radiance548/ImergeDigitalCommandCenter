"use client";

import Image from "next/image";
import { useState } from "react";
import { useAppStore } from "@/store/useAppStore";

export default function LoginScreen() {
  const login = useAppStore((s) => s.login);
  const resetDemoData = useAppStore((s) => s.resetDemoData);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  return (
    <section className="login-screen">
      <div className="login-card">
        <div className="login-logo">
          <Image src="/logo-icon.png" alt="" width={58} height={61} priority />
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
        <button className="btn" style={{ width: "100%", marginTop: 10 }} onClick={() => resetDemoData()}>
          Fix login / reset local data
        </button>
        <p style={{ color: "var(--muted)", fontSize: 12, marginBottom: 0 }}>Forgot password? Contact your administrator.</p>
      </div>
    </section>
  );
}
