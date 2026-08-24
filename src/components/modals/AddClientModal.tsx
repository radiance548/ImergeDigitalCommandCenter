"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { useAppStore } from "@/store/useAppStore";
import { useUIStore } from "@/store/useUIStore";
import type { ClientRecord } from "@/lib/types";

const TIERS: ClientRecord["tier"][] = ["A", "B", "C"];
const SERVICES = ["SEO", "PPC", "Design", "Web", "Content"];

export default function AddClientModal() {
  const closeModal = useUIStore((s) => s.closeModal);
  const addClient = useAppStore((s) => s.addClient);

  const [name, setName] = useState("New Client");
  const [tier, setTier] = useState<ClientRecord["tier"]>("A");
  const [serviceLine, setServiceLine] = useState(SERVICES[0]);
  const [monthlyRetainer, setMonthlyRetainer] = useState(5000);
  const [contractHours, setContractHours] = useState(40);
  const [actualHours, setActualHours] = useState(45);
  const [scopeCreepHours, setScopeCreepHours] = useState(5);
  const [billableExpenses, setBillableExpenses] = useState(500);
  const [clientRevenue, setClientRevenue] = useState(7000);

  const save = async () => {
    await addClient({
      name,
      tier,
      serviceLine,
      monthlyRetainer: Number(monthlyRetainer),
      contractHours: Number(contractHours),
      actualHours: Number(actualHours),
      scopeCreepHours: Number(scopeCreepHours),
      billableExpenses: Number(billableExpenses),
      clientRevenue: Number(clientRevenue),
    });
    closeModal();
  };

  return (
    <Modal title="Add Client Profitability Record" onClose={closeModal}>
      <div className="form-grid">
        <div className="field">
          <label>Client Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>Tier</label>
          <select value={tier} onChange={(e) => setTier(e.target.value as ClientRecord["tier"])}>
            {TIERS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Service Line</label>
          <select value={serviceLine} onChange={(e) => setServiceLine(e.target.value)}>
            {SERVICES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Monthly Retainer</label>
          <input type="number" value={monthlyRetainer} onChange={(e) => setMonthlyRetainer(Number(e.target.value))} />
        </div>
        <div className="field">
          <label>Contract Hours</label>
          <input type="number" value={contractHours} onChange={(e) => setContractHours(Number(e.target.value))} />
        </div>
        <div className="field">
          <label>Actual Hours</label>
          <input type="number" value={actualHours} onChange={(e) => setActualHours(Number(e.target.value))} />
        </div>
        <div className="field">
          <label>Scope Creep Hours</label>
          <input type="number" value={scopeCreepHours} onChange={(e) => setScopeCreepHours(Number(e.target.value))} />
        </div>
        <div className="field">
          <label>Billable Expenses</label>
          <input type="number" value={billableExpenses} onChange={(e) => setBillableExpenses(Number(e.target.value))} />
        </div>
        <div className="field">
          <label>Client Revenue</label>
          <input type="number" value={clientRevenue} onChange={(e) => setClientRevenue(Number(e.target.value))} />
        </div>
        <button className="btn primary" onClick={save}>
          Save Client
        </button>
      </div>
    </Modal>
  );
}
