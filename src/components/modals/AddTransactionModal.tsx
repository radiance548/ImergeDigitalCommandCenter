"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { useAppStore } from "@/store/useAppStore";
import { useUIStore } from "@/store/useUIStore";
import { dateISO } from "@/lib/utils";

export default function AddTransactionModal() {
  const closeModal = useUIStore((s) => s.closeModal);
  const addTransaction = useAppStore((s) => s.addTransaction);
  const add20DemoTransactions = useAppStore((s) => s.add20DemoTransactions);

  const [date, setDate] = useState(dateISO(new Date()));
  const [type, setType] = useState<"income" | "expense">("income");
  const [category, setCategory] = useState("Retainer");
  const [amount, setAmount] = useState(5000);
  const [description, setDescription] = useState("New transaction");

  const save = async () => {
    await addTransaction({ date, type, category, amount: Number(amount), description });
    closeModal();
  };

  return (
    <Modal title="Add Transaction" onClose={closeModal}>
      <div className="form-grid">
        <div className="field">
          <label>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="field">
          <label>Type</label>
          <select value={type} onChange={(e) => setType(e.target.value as "income" | "expense")}>
            <option value="income">income</option>
            <option value="expense">expense</option>
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
          <label>Note</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <button className="btn primary" onClick={save}>
          Save Transaction
        </button>
        <button className="btn" onClick={() => add20DemoTransactions().then(closeModal)}>
          Add 20 demo transactions
        </button>
      </div>
    </Modal>
  );
}
