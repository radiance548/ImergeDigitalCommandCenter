"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { useAppStore } from "@/store/useAppStore";
import { useUIStore } from "@/store/useUIStore";
import { dateISO } from "@/lib/utils";

export default function AddTimeEntryModal() {
  const closeModal = useUIStore((s) => s.closeModal);
  const clients = useAppStore((s) => s.data?.clients || []);
  const addTimeEntry = useAppStore((s) => s.addTimeEntry);

  const [clientId, setClientId] = useState(clients[0]?.id || "");
  const [date, setDate] = useState(dateISO(new Date()));
  const [hours, setHours] = useState(3);
  const [billable, setBillable] = useState(true);

  const save = async () => {
    if (!clientId) return;
    await addTimeEntry({ clientId, date, hours: Number(hours), description: "Manual time entry", billable, approved: false });
    closeModal();
  };

  return (
    <Modal title="Add Time Entry" onClose={closeModal}>
      <div className="form-grid">
        <div className="field">
          <label>Client</label>
          <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="field">
          <label>Hours</label>
          <input type="number" value={hours} onChange={(e) => setHours(Number(e.target.value))} />
        </div>
        <div className="field">
          <label>Billable</label>
          <select value={billable ? "true" : "false"} onChange={(e) => setBillable(e.target.value === "true")}>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>
        <button className="btn primary" onClick={save}>
          Save Time
        </button>
      </div>
    </Modal>
  );
}
