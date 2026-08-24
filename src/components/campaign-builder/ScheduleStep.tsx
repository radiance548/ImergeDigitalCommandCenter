"use client";

import { useState } from "react";
import { campaignApi, type Campaign } from "@/lib/campaignApi";

interface ScheduleStepProps {
  campaign: Campaign;
  onCampaignUpdate: (campaign: Campaign) => void;
  readOnly: boolean;
}

export default function ScheduleStep({ campaign, onCampaignUpdate, readOnly }: ScheduleStepProps) {
  const [scheduledAt, setScheduledAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const canSend = Boolean(campaign.audienceId) && Boolean(campaign.fromEmail) && campaign.status === "draft";

  const runAction = async (action: () => Promise<Campaign>, successMsg: string) => {
    setBusy(true);
    setError(null);
    try {
      const result = await action();
      onCampaignUpdate(result);
      setNotice(successMsg);
      setTimeout(() => setNotice(null), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel-card">
      <h3>Schedule or Send</h3>
      {!campaign.audienceId && (
        <div className="alert">Pick an audience in the previous step before you can send this campaign.</div>
      )}
      {!campaign.fromEmail && (
        <div className="alert">
          Set a From email in the Content step first — it must be on a domain you&apos;ve verified in{" "}
          <a href="https://resend.com/domains" target="_blank" rel="noreferrer">
            Resend
          </a>
          .
        </div>
      )}
      {error && <div className="alert">{error}</div>}
      {notice && <p style={{ color: "var(--success)", fontWeight: 800 }}>{notice}</p>}

      <div className="form-grid" style={{ marginBottom: 16 }}>
        <div className="field">
          <label>Sends via</label>
          <div style={{ paddingTop: 8, fontWeight: 800 }}>
            <span className="badge">
              <i className="fa-solid fa-paper-plane" /> Resend Broadcasts
            </span>
          </div>
        </div>
        <div className="field">
          <label>Current status</label>
          <div style={{ paddingTop: 8 }}>
            <span className={`status-pill ${campaign.status}`}>{campaign.status}</span>
          </div>
        </div>
      </div>

      {campaign.status === "draft" && (
        <>
          <div className="form-grid" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Schedule for later (optional)</label>
              <input
                type="datetime-local"
                disabled={readOnly}
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              className="btn primary"
              disabled={!canSend || busy || readOnly}
              onClick={() => runAction(() => campaignApi.sendNow(campaign.id).then((r) => r.campaign), "Sent!")}
            >
              <i className="fa-solid fa-paper-plane" /> Send now
            </button>
            <button
              className="btn"
              disabled={!canSend || busy || !scheduledAt || readOnly}
              onClick={() =>
                runAction(
                  () => campaignApi.schedule(campaign.id, new Date(scheduledAt).toISOString()).then((r) => r.campaign),
                  "Campaign scheduled with Resend."
                )
              }
            >
              <i className="fa-solid fa-clock" /> Schedule
            </button>
          </div>
        </>
      )}

      {campaign.status === "scheduled" && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <p style={{ margin: 0 }}>
            Scheduled for <strong>{campaign.scheduledAt && new Date(campaign.scheduledAt).toLocaleString()}</strong> —
            Resend will send it automatically.
          </p>
          <button
            className="btn danger"
            disabled={busy || readOnly}
            onClick={() =>
              runAction(() => campaignApi.cancelSchedule(campaign.id).then((r) => r.campaign), "Schedule canceled.")
            }
          >
            Cancel schedule
          </button>
        </div>
      )}

      {campaign.status === "sent" && (
        <p style={{ color: "var(--muted)", fontWeight: 700 }}>
          Handed off to Resend {campaign.sentAt ? `at ${new Date(campaign.sentAt).toLocaleString()}` : ""}. See the
          Analytics step for delivery results as they come in via webhook.
        </p>
      )}

      {campaign.status === "failed" && (
        <p style={{ color: "var(--danger)", fontWeight: 700 }}>
          This campaign failed to send. Check your Resend API key and audience sync, then try again.
        </p>
      )}
    </div>
  );
}
