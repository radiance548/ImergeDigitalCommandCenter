"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { useAppStore } from "@/store/useAppStore";
import { useUIStore } from "@/store/useUIStore";
import { dateISO } from "@/lib/utils";

export default function AddHealthRecordModal() {
  const closeModal = useUIStore((s) => s.closeModal);
  const addTransaction = useAppStore((s) => s.addTransaction);

  const [date, setDate] = useState(dateISO(new Date()));
  const [type, setType] = useState<"income" | "expense">("income");
  const [category, setCategory] = useState("Business Health");
  const [amount, setAmount] = useState(10000);
  const [description, setDescription] = useState("Business health adjustment");

  const save = async () => {
    await addTransaction({ date, type, category, amount: Number(amount), description });
    closeModal();
  };

  return (
    <Modal title="Add Business Health Financial Record" onClose={closeModal}>
      <p style={{ color: "var(--muted)", fontWeight: 700 }}>
        This adds a financial transaction that immediately affects cash balance, burn rate, runway, margins, and business
        health charts.
      </p>
      <div className="form-grid">
        <div className="field">
          <label>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="field">
          <label>Record Type</label>
          <select value={type} onChange={(e) => setType(e.target.value as "income" | "expense")}>
            <option value="income">Revenue / Cash In</option>
            <option value="expense">Expense / Cash Out</option>
          </select>
        </div>
        <div className="field">
          <label>Category</label>
          <input value={category} onChange={(e) => setCategory(e.target.value)} />
        </div>
        <div className="field">
          <label>Amount</label>
          <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
        </div>
        <div className="field" style={{ gridColumn: "1/-1" }}>
          <label>Description</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <button className="btn primary" onClick={save}>
          Save Record
        </button>
      </div>
    </Modal>
  );
}
