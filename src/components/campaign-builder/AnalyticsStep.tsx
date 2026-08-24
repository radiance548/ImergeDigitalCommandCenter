"use client";

import { useEffect, useState } from "react";
import { campaignApi, type Campaign, type CampaignAnalytics } from "@/lib/campaignApi";

function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

export default function AnalyticsStep({ campaign }: { campaign: Campaign }) {
  const [analytics, setAnalytics] = useState<CampaignAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasSent = campaign.status === "sent" || campaign.status === "sending" || campaign.status === "failed";

  useEffect(() => {
    if (!hasSent) return;
    const load = () =>
      campaignApi
        .analytics(campaign.id)
        .then((res) => setAnalytics(res.analytics))
        .catch((e) => setError(e.message));
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [campaign.id, hasSent]);

  if (!hasSent) {
    return (
      <div className="panel-card">
        <h3>Analytics</h3>
        <p style={{ color: "var(--muted)", fontWeight: 700 }}>
          Analytics will appear here once this campaign has been sent. Complete the Schedule/Send step first.
        </p>
      </div>
    );
  }

  return (
    <div className="panel-card">
      <h3>Analytics</h3>
      {error && <div className="alert">{error}</div>}
      {!analytics && <p style={{ color: "var(--muted)" }}>Loading…</p>}
      {analytics && (
        <>
          <div className="analytics-grid" style={{ marginBottom: 18 }}>
            <div className="kpi-card">
              <small>Recipients</small>
              <h2>{analytics.totalRecipients}</h2>
            </div>
            <div className="kpi-card">
              <small>Pending</small>
              <h2>{analytics.pending}</h2>
            </div>
            <div className="kpi-card">
              <small>Sent</small>
              <h2>{analytics.sent}</h2>
            </div>
            <div className="kpi-card">
              <small>Delivered</small>
              <h2>{analytics.delivered}</h2>
              <span>{pct(analytics.deliveryRate)}</span>
            </div>
            <div className="kpi-card">
              <small>Opened</small>
              <h2>{analytics.opened}</h2>
              <span>{pct(analytics.openRate)}</span>
            </div>
            <div className="kpi-card">
              <small>Clicked</small>
              <h2>{analytics.clicked}</h2>
              <span>{pct(analytics.clickRate)}</span>
            </div>
            <div className="kpi-card">
              <small>Engaged</small>
              <h2>{analytics.engaged}</h2>
              <span>{pct(analytics.engagedRate)}</span>
            </div>
            <div className="kpi-card">
              <small>Bounced</small>
              <h2>{analytics.bounced}</h2>
              <span>{pct(analytics.bounceRate)}</span>
            </div>
            <div className="kpi-card">
              <small>Unsubscribed</small>
              <h2>{analytics.unsubscribed}</h2>
            </div>
            <div className="kpi-card">
              <small>Complained</small>
              <h2>{analytics.complained}</h2>
            </div>
          </div>
          <p style={{ color: "var(--muted)", fontSize: 12 }}>
            Delivered/opened/clicked/bounced figures depend on your mail provider sending delivery webhooks to{" "}
            <code>/api/webhooks/mail/{campaign.provider}</code>. The console provider only ever shows &quot;sent&quot;.
          </p>
          <p style={{ color: "var(--muted)", fontSize: 12 }}>
            &quot;Opened&quot; can run higher than real readership — some mail apps preview messages
            automatically before a recipient ever looks at them. &quot;Engaged&quot; only counts recipients
            who opened and then clicked a link, so it&apos;s the more reliable sign of genuine interest.
          </p>
        </>
      )}
    </div>
  );
}
