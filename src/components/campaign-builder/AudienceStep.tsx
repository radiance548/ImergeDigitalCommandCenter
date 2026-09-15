"use client";

import { useEffect, useRef, useState } from "react";
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
  const [file, setFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    let createdAudienceId: string | null = null;
    try {
      const { audience } = await campaignApi.audiences.create({ name: newName.trim() });
      createdAudienceId = audience.id;
      // One contact per line: "email" alone, or "email, First, Last" — the
      // first/last name is what {{{contact.first_name|there}}}-style merge
      // tags in campaign content actually resolve to (see ContentStep) —
      // without it, every send falls back to "there" for everyone.
      const contacts = pastedEmails
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [email, firstName, lastName] = line.split(",").map((part) => part.trim());
          return { email, firstName: firstName || undefined, lastName: lastName || undefined };
        })
        .filter((c) => c.email.includes("@"));
      // The import API caps each request at 5000 contacts (it upserts the
      // whole batch inside one DB transaction) — split larger pastes into
      // chunks so a big list doesn't just fail outright.
      const IMPORT_CHUNK_SIZE = 5000;
      for (let i = 0; i < contacts.length; i += IMPORT_CHUNK_SIZE) {
        await campaignApi.audiences.importContacts(audience.id, contacts.slice(i, i + IMPORT_CHUNK_SIZE));
      }

      let fileNotice = "";
      if (file) {
        const fileResult = await campaignApi.audiences.importContactsFile(audience.id, file);
        fileNotice = ` + ${fileResult.imported} from "${file.name}"${fileResult.skipped ? ` (${fileResult.skipped} skipped — no valid email)` : ""}`;
      }

      setNewName("");
      setPastedEmails("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setNotice(`Created "${audience.name}" with ${contacts.length} pasted contact(s)${fileNotice}.`);
      onSelect(audience.id);
      refresh();
      setTimeout(() => setNotice(null), 5000);
    } catch (e) {
      // If contact import failed after the audience itself was already
      // created, roll it back rather than leaving an empty, orphaned
      // audience behind for every failed/retried attempt.
      if (createdAudienceId) {
        campaignApi.audiences.remove(createdAudienceId).catch((cleanupError) => {
          console.error("Failed to roll back a partially-created audience:", cleanupError);
        });
      }
      setError(e instanceof Error ? e.message : "Could not create audience");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="chart-grid">
      <div className="panel-card span-7">
        <div className="panel-card-header">
          <div className="panel-card-icon">
            <i className="fa-solid fa-users" />
          </div>
          <div>
            <h3>Choose an Audience</h3>
            <p>Select who this campaign sends to, or build a new list on the right.</p>
          </div>
        </div>
        {error && <div className="alert">{error}</div>}
        {!audiences && (
          <div className="empty-state">
            <i className="fa-solid fa-circle-notch fa-spin" />
            <p>Loading audiences…</p>
          </div>
        )}
        <div className="audience-list">
          {(audiences || []).map((a) => (
            <div
              key={a.id}
              className={`audience-row ${selectedAudienceId === a.id ? "selected" : ""}`}
              onClick={() => !readOnly && onSelect(a.id)}
            >
              <div className="audience-row-name">
                <span className="audience-row-icon">
                  <i className="fa-solid fa-users" />
                </span>
                <div>
                  <strong>{a.name}</strong>
                  {a.description && <div style={{ color: "var(--muted)", fontSize: 12 }}>{a.description}</div>}
                </div>
              </div>
              <span className="badge">{a._count?.contacts ?? 0} contacts</span>
            </div>
          ))}
          {audiences && audiences.length === 0 && (
            <div className="empty-state">
              <i className="fa-solid fa-inbox" />
              <p>No audiences yet — create one on the right.</p>
            </div>
          )}
        </div>
      </div>

      {!readOnly && (
        <div className="panel-card span-5">
          <div className="panel-card-header">
            <div className="panel-card-icon">
              <i className="fa-solid fa-wand-magic-sparkles" />
            </div>
            <div>
              <h3>Create New Audience</h3>
              <p>Name it, then paste contacts, upload a spreadsheet, or both.</p>
            </div>
          </div>

          {notice && <div className="alert" style={{ borderLeftColor: "var(--success)", color: "var(--success)" }}>{notice}</div>}

          <div className="form-section">
            <div className="form-section-label">
              <span className="step-badge">1</span> Audience name
            </div>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Newsletter subscribers" />
          </div>

          <div className="form-section">
            <div className="form-section-label">
              <span className="step-badge">2</span> Paste contacts
              <span className="optional-tag">optional</span>
            </div>
            <textarea
              rows={6}
              style={{ width: "100%" }}
              value={pastedEmails}
              onChange={(e) => setPastedEmails(e.target.value)}
              placeholder={"ada@example.com, Ada, Lovelace\nkofi@example.com, Kofi"}
            />
            <p className="form-hint">
              <i className="fa-solid fa-circle-info" />
              One per line. First/last name are optional but drive email personalization — without them a contact
              falls back to the default greeting.
            </p>
          </div>

          <div className="or-divider">
            <span>OR</span>
          </div>

          <div className="form-section">
            <div className="form-section-label">
              <span className="step-badge">3</span> Upload a spreadsheet
              <span className="optional-tag">optional</span>
            </div>
            <label className={`file-drop ${file ? "has-file" : ""}`} htmlFor="audience-file-input">
              {file ? (
                <div className="file-drop-filename">
                  <i className="fa-solid fa-file-circle-check" style={{ marginBottom: 0 }} />
                  <span>{file.name}</span>
                  <button
                    type="button"
                    className="file-drop-remove"
                    onClick={(e) => {
                      e.preventDefault();
                      setFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    aria-label="Remove file"
                  >
                    <i className="fa-solid fa-xmark" />
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    <i className="fa-solid fa-file-arrow-up" />
                  </div>
                  <span className="file-drop-label">Choose a file (.xlsx, .xls, .csv)</span>
                </>
              )}
              <input
                id="audience-file-input"
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <p className="form-hint">
              <i className="fa-solid fa-circle-info" />
              Needs an Email column, a Name column (or First Name/Last Name), and optionally Phone. Combines with any
              pasted contacts above.
            </p>
          </div>

          <button className="btn primary" style={{ width: "100%", justifyContent: "center" }} disabled={creating} onClick={createAudience}>
            <i className={`fa-solid ${creating ? "fa-circle-notch fa-spin" : "fa-circle-plus"}`} />
            {creating ? "Creating…" : "Create audience"}
          </button>
        </div>
      )}
    </div>
  );
}
