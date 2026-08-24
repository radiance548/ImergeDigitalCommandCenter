"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { useAppStore } from "@/store/useAppStore";
import { useUIStore } from "@/store/useUIStore";
import type { DealStage } from "@/lib/types";

const STAGES: DealStage[] = ["Proposal", "Negotiation", "Closed Won", "Closed Lost"];
const ROLES = ["SEO", "PPC", "Design", "Web", "Content"];

export default function AddDealModal() {
  const closeModal = useUIStore((s) => s.closeModal);
  const addDeal = useAppStore((s) => s.addDeal);

  const [clientName, setClientName] = useState("New Client");
  const [value, setValue] = useState(12000);
  const [stage, setStage] = useState<DealStage>("Proposal");
  const [requiredRole, setRequiredRole] = useState(ROLES[0]);
  const [hoursNeeded, setHoursNeeded] = useState(40);

  const save = async () => {
    await addDeal({ clientName, value: Number(value), stage, requiredRole, hoursNeeded: Number(hoursNeeded) });
    closeModal();
  };

  return (
    <Modal title="Add Deal" onClose={closeModal}>
      <div className="form-grid">
        <div className="field">
          <label>Client Name</label>
          <input value={clientName} onChange={(e) => setClientName(e.target.value)} />
        </div>
        <div className="field">
          <label>Value</label>
          <input type="number" value={value} onChange={(e) => setValue(Number(e.target.value))} />
        </div>
        <div className="field">
          <label>Stage</label>
          <select value={stage} onChange={(e) => setStage(e.target.value as DealStage)}>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Role</label>
          <select value={requiredRole} onChange={(e) => setRequiredRole(e.target.value)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Hours Needed</label>
          <input type="number" value={hoursNeeded} onChange={(e) => setHoursNeeded(Number(e.target.value))} />
        </div>
        <button className="btn primary" onClick={save}>
          Save Deal
        </button>
      </div>
    </Modal>
  );
}
