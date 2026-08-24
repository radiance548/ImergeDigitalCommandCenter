"use client";

import { useEffect, useState } from "react";
import { campaignApi, type Audience } from "@/lib/campaignApi";

interface AudienceStepProps {
  selectedAudienceId: string | null | undefined;
  onSelect: (audienceId: string) => void;
  readOnly: boolean;
}

export default function AudienceStep({ selectedAudienceId, onSelect, readOnly }: AudienceStepProps) {
  const [audiences, setAudiences] = useState<Audience[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [pastedEmails, setPastedEmails] = useState("");
  const [creating, setCreating] = useState(false);

  const refresh = () => {
    campaignApi.audiences
      .list()
      .then((res) => setAudiences(res.audiences))
      .catch((e) => setError(e.message));
  };

  useEffect(refresh, []);

  const createAudience = async () => {
    if (!newName.trim()) {
      setError("Give the audience a name first.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const { audience } = await campaignApi.audiences.create({ name: newName.trim() });
      const contacts = pastedEmails
        .split(/[\s,]+/)
        .map((e) => e.trim())
        .filter((e) => e.includes("@"))
        .map((email) => ({ email }));
      if (contacts.length) {
        await campaignApi.audiences.importContacts(audience.id, contacts);
      }
      setNewName("");
      setPastedEmails("");
      setNotice(`Created "${audience.name}" with ${contacts.length} contact(s).`);
      onSelect(audience.id);
      refresh();
      setTimeout(() => setNotice(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create audience");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="chart-grid">
      <div className="panel-card span-7">
        <h3>Choose an Audience</h3>
        {error && <div className="alert">{error}</div>}
        {!audiences && <p style={{ color: "var(--muted)" }}>Loading audiences…</p>}
        <div className="audience-list">
          {(audiences || []).map((a) => (
            <div
              key={a.id}
              className={`audience-row ${selectedAudienceId === a.id ? "selected" : ""}`}
              onClick={() => !readOnly && onSelect(a.id)}
            >
              <div>
                <strong>{a.name}</strong>
                {a.description && <div style={{ color: "var(--muted)", fontSize: 12 }}>{a.description}</div>}
              </div>
              <span className="badge">{a._count?.contacts ?? 0} contacts</span>
            </div>
          ))}
          {audiences && audiences.length === 0 && (
            <p style={{ color: "var(--muted)" }}>No audiences yet — create one on the right.</p>
          )}
        </div>
      </div>

      {!readOnly && (
        <div className="panel-card span-5">
          <h3>Create New Audience</h3>
          {notice && <p style={{ color: "var(--success)", fontWeight: 800 }}>{notice}</p>}
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Audience name</label>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Newsletter subscribers" />
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Paste emails (comma or newline separated)</label>
            <textarea
              rows={6}
              style={{ width: "100%" }}
              value={pastedEmails}
              onChange={(e) => setPastedEmails(e.target.value)}
              placeholder={"ada@example.com\nkofi@example.com"}
            />
          </div>
          <button className="btn primary" disabled={creating} onClick={createAudience}>
            {creating ? "Creating…" : "Create audience"}
          </button>
        </div>
      )}
    </div>
  );
}
