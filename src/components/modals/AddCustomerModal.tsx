"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { useAppStore } from "@/store/useAppStore";
import { useUIStore } from "@/store/useUIStore";
import { dateISO } from "@/lib/utils";

const CHANNELS = ["SEO", "PPC", "Social", "Email"];

export default function AddCustomerModal() {
  const closeModal = useUIStore((s) => s.closeModal);
  const addCustomer = useAppStore((s) => s.addCustomer);

  const [name, setName] = useState("New Customer");
  const [acquisitionDate, setAcquisitionDate] = useState(dateISO(new Date()));
  const [acquisitionChannel, setAcquisitionChannel] = useState(CHANNELS[0]);
  const [cac, setCac] = useState(800);
  const [firstYearRevenue, setFirstYearRevenue] = useState(6000);
  const [lifetimeRevenue, setLifetimeRevenue] = useState(18000);
  const [status, setStatus] = useState<"active" | "churned">("active");

  const save = async () => {
    await addCustomer({
      name,
      acquisitionDate,
      acquisitionChannel,
      cac: Number(cac),
      firstYearRevenue: Number(firstYearRevenue),
      lifetimeRevenue: Number(lifetimeRevenue),
      churnDate: status === "churned" ? dateISO(new Date()) : null,
    });
    closeModal();
  };

  return (
    <Modal title="Add Customer / LTV-CAC Record" onClose={closeModal}>
      <div className="form-grid">
        <div className="field">
          <label>Customer Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>Acquisition Date</label>
          <input type="date" value={acquisitionDate} onChange={(e) => setAcquisitionDate(e.target.value)} />
        </div>
        <div className="field">
          <label>Channel</label>
          <select value={acquisitionChannel} onChange={(e) => setAcquisitionChannel(e.target.value)}>
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>CAC</label>
          <input type="number" value={cac} onChange={(e) => setCac(Number(e.target.value))} />
        </div>
        <div className="field">
          <label>First Year Revenue</label>
          <input type="number" value={firstYearRevenue} onChange={(e) => setFirstYearRevenue(Number(e.target.value))} />
        </div>
        <div className="field">
          <label>Lifetime Revenue</label>
          <input type="number" value={lifetimeRevenue} onChange={(e) => setLifetimeRevenue(Number(e.target.value))} />
        </div>
        <div className="field">
          <label>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as "active" | "churned")}>
            <option value="active">Active</option>
            <option value="churned">Churned</option>
          </select>
        </div>
        <button className="btn primary" onClick={save}>
          Save Customer
        </button>
      </div>
    </Modal>
  );
}
