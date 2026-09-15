"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { campaignApi, type Campaign } from "@/lib/campaignApi";
import { useAppStore } from "@/store/useAppStore";

export default function CampaignsListPage() {
  const router = useRouter();
  const canEdit = useAppStore((s) => s.canEdit("marketing"));
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    campaignApi
      .list()
      .then((res) => setCampaigns(res.campaigns))
      .catch((e) => setError(e.message));
  }, []);

  const createDraft = async () => {
    setCreating(true);
    try {
      const { campaign } = await campaignApi.create({
        subject: "New campaign",
        bodyHtml: "<p>Write your email content…</p>",
        fromName: "Imerge",
        // Left blank on purpose — a placeholder value here (e.g. the old
        // "hello@yourdomain.com") looks like a real, already-filled-in
        // sending address, and Plunk will only reject it as an unverified
        // domain once you actually try to send. Leaving it empty forces a
        // real, verified domain to be entered in Content step before send.
        fromEmail: "",
      });
      router.push(`/marketing/campaigns/${campaign.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create campaign");
      setCreating(false);
    }
  };

  return (
    <>
      {canEdit && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <button className="btn primary" disabled={creating} onClick={createDraft}>
            <i className="fa-solid fa-plus" /> New campaign
          </button>
        </div>
      )}

      {error && (
        <div className="alert" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Subject</th>
              <th>Status</th>
              <th>Audience</th>
              <th>Recipients</th>
              <th>Scheduled / Sent</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(campaigns || []).map((c) => (
              <tr key={c.id} style={{ cursor: "pointer" }} onClick={() => router.push(`/marketing/campaigns/${c.id}`)}>
                <td>
                  <strong>{c.subject}</strong>
                </td>
                <td>
                  <span className={`status-pill ${c.status}`}>{c.status}</span>
                </td>
                <td>{c.audience?.name || "—"}</td>
                <td>{c._count?.recipients ?? 0}</td>
                <td>{c.sentAt ? new Date(c.sentAt).toLocaleString() : c.scheduledAt ? new Date(c.scheduledAt).toLocaleString() : "—"}</td>
                <td>
                  <button className="btn">Open</button>
                </td>
              </tr>
            ))}
            {campaigns && campaigns.length === 0 && (
              <tr>
                <td colSpan={6} style={{ color: "var(--muted)", textAlign: "center", padding: 24 }}>
                  No campaigns yet. Create one to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
