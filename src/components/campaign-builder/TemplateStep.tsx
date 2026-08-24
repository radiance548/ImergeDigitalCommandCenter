"use client";

import { useEffect, useState } from "react";
import { campaignApi, type EmailTemplate } from "@/lib/campaignApi";

interface TemplateStepProps {
  selectedTemplateId: string | null | undefined;
  onSelect: (templateId: string, html: string) => void;
  readOnly: boolean;
}

export default function TemplateStep({ selectedTemplateId, onSelect, readOnly }: TemplateStepProps) {
  const [templates, setTemplates] = useState<EmailTemplate[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    campaignApi.templates
      .list()
      .then((res) => setTemplates(res.templates))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="panel-card">
      <h3>Choose a Template</h3>
      <p style={{ color: "var(--muted)", fontWeight: 700 }}>
        Selecting a template replaces your current email body with the template's HTML — you can still edit it
        afterward in the Content step.
      </p>
      {error && <div className="alert">{error}</div>}
      {!templates && <p style={{ color: "var(--muted)" }}>Loading templates…</p>}
      <div className="template-grid">
        {(templates || []).map((t) => (
          <div
            key={t.id}
            className={`template-card ${selectedTemplateId === t.id ? "selected" : ""}`}
            onClick={() => !readOnly && onSelect(t.id, t.html)}
          >
            <h4>{t.name}</h4>
            <p>{t.description || (t.isSystem ? "Starter template" : "Custom template")}</p>
          </div>
        ))}
        {templates && templates.length === 0 && (
          <p style={{ color: "var(--muted)" }}>No templates yet — run the database seed script to add starter templates.</p>
        )}
      </div>
    </div>
  );
}
