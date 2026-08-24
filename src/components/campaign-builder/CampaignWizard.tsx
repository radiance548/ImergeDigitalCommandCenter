"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { campaignApi, type Campaign } from "@/lib/campaignApi";
import ContentStep from "./ContentStep";
import TemplateStep from "./TemplateStep";
import AudienceStep from "./AudienceStep";
import ScheduleStep from "./ScheduleStep";
import AnalyticsStep from "./AnalyticsStep";

const STEPS = [
  { key: "content", label: "1. Content" },
  { key: "template", label: "2. Template" },
  { key: "audience", label: "3. Audience" },
  { key: "schedule", label: "4. Schedule / Send" },
  { key: "analytics", label: "5. Analytics" },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

export default function CampaignWizard({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [draft, setDraft] = useState<Partial<Campaign>>({});
  const [step, setStep] = useState<StepKey>("content");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = () => {
    campaignApi
      .get(campaignId)
      .then((res) => {
        setCampaign(res.campaign);
        setDraft(res.campaign);
      })
      .catch((e) => setError(e.message));
  };

  useEffect(load, [campaignId]);

  const readOnly = campaign ? campaign.status !== "draft" : true;

  const patchCampaign = async (patch: Partial<Campaign>) => {
    setSaving(true);
    setError(null);
    try {
      const { campaign: updated } = await campaignApi.update(campaignId, patch);
      setCampaign(updated);
      setDraft(updated);
      setNotice("Saved.");
      setTimeout(() => setNotice(null), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save changes");
    } finally {
      setSaving(false);
    }
  };

  const deleteCampaign = async () => {
    if (!confirm("Delete this campaign? This cannot be undone.")) return;
    await campaignApi.remove(campaignId);
    router.push("/marketing/campaigns");
  };

  if (!campaign) {
    return (
      <div className="panel-card">
        {error ? <p style={{ color: "var(--danger)" }}>{error}</p> : <p style={{ color: "var(--muted)" }}>Loading campaign…</p>}
      </div>
    );
  }

  return (
    <>
      <div className="topbar" style={{ marginBottom: 12 }}>
        <div className="page-title">
          <h1>{campaign.subject || "Untitled campaign"}</h1>
          <p>
            <span className={`status-pill ${campaign.status}`}>{campaign.status}</span>
            {saving && <span style={{ marginLeft: 10, color: "var(--muted)" }}>Saving…</span>}
            {notice && <span style={{ marginLeft: 10, color: "var(--success)" }}>{notice}</span>}
          </p>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => router.push("/marketing/campaigns")}>
            <i className="fa-solid fa-arrow-left" /> All campaigns
          </button>
          {campaign.status === "draft" && (
            <button className="btn danger" onClick={deleteCampaign}>
              Delete
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="alert" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div className="wizard-tabs">
        {STEPS.map((s, i) => (
          <button key={s.key} className={`wizard-tab ${step === s.key ? "active" : ""}`} onClick={() => setStep(s.key)}>
            <span className="step-num">{i + 1}</span>
            {s.label.replace(/^\d+\.\s*/, "")}
          </button>
        ))}
      </div>

      {step === "content" && (
        <>
          <ContentStep draft={draft} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} readOnly={readOnly} />
          {!readOnly && (
            <div style={{ marginTop: 14 }}>
              <button className="btn primary" disabled={saving} onClick={() => patchCampaign(draft)}>
                Save content
              </button>
            </div>
          )}
        </>
      )}

      {step === "template" && (
        <TemplateStep
          selectedTemplateId={campaign.templateId}
          readOnly={readOnly}
          onSelect={(templateId, html) => patchCampaign({ templateId, bodyHtml: html })}
        />
      )}

      {step === "audience" && (
        <AudienceStep
          selectedAudienceId={campaign.audienceId}
          readOnly={readOnly}
          onSelect={(audienceId) => patchCampaign({ audienceId })}
        />
      )}

      {step === "schedule" && (
        <ScheduleStep
          campaign={campaign}
          readOnly={readOnly}
          onCampaignUpdate={(updated) => {
            setCampaign(updated);
            setDraft(updated);
          }}
        />
      )}

      {step === "analytics" && <AnalyticsStep campaign={campaign} />}
    </>
  );
}
