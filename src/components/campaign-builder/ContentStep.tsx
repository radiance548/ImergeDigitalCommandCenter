"use client";

import type { Campaign } from "@/lib/campaignApi";

interface ContentStepProps {
  draft: Partial<Campaign>;
  onChange: (patch: Partial<Campaign>) => void;
  readOnly: boolean;
}

export default function ContentStep({ draft, onChange, readOnly }: ContentStepProps) {
  return (
    <div className="chart-grid">
      <div className="panel-card span-6">
        <h3>Email Content</h3>
        <div className="field" style={{ marginBottom: 12 }}>
          <label>Subject line</label>
          <input
            value={draft.subject || ""}
            disabled={readOnly}
            onChange={(e) => onChange({ subject: e.target.value })}
            placeholder="e.g. Your March product update"
          />
        </div>
        <div className="field" style={{ marginBottom: 12 }}>
          <label>Preheader (preview text)</label>
          <input
            value={draft.preheader || ""}
            disabled={readOnly}
            onChange={(e) => onChange({ preheader: e.target.value })}
            placeholder="Shown next to the subject in most inboxes"
          />
        </div>
        <div className="form-grid" style={{ marginBottom: 12 }}>
          <div className="field">
            <label>From name</label>
            <input value={draft.fromName || ""} disabled={readOnly} onChange={(e) => onChange({ fromName: e.target.value })} />
          </div>
          <div className="field">
            <label>From email</label>
            <input
              type="email"
              value={draft.fromEmail || ""}
              disabled={readOnly}
              onChange={(e) => onChange({ fromEmail: e.target.value })}
              placeholder="hello@yourdomain.com"
            />
          </div>
        </div>
        <div className="field">
          <label>Body (HTML)</label>
          <textarea
            rows={16}
            style={{ width: "100%", fontFamily: "monospace", fontSize: 13 }}
            value={draft.bodyHtml || ""}
            disabled={readOnly}
            onChange={(e) => onChange({ bodyHtml: e.target.value })}
          />
        </div>
        <p style={{ color: "var(--muted)", fontSize: 12 }}>
          Plunk fills these in per recipient at send time — double braces, optional{" "}
          <code>{"?? 'fallback'"}</code>: <code>{"{{firstName ?? 'there'}}"}</code>,{" "}
          <code>{"{{lastName}}"}</code>, <code>{"{{email}}"}</code>, or any custom contact property. Plunk
          automatically appends its own unsubscribe footer to every send, so you don&apos;t need to add one — only
          use <code>{"{{unsubscribeUrl}}"}</code> yourself if you want a custom-styled link instead of the default
          footer.
        </p>
      </div>
      <div className="panel-card span-6">
        <h3>Live Preview</h3>
        <iframe
          className="email-preview"
          title="Email preview"
          srcDoc={draft.bodyHtml || "<p style='font-family:sans-serif;color:#888;padding:20px;'>Nothing to preview yet.</p>"}
        />
      </div>
    </div>
  );
}
