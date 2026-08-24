"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { useAppStore } from "@/store/useAppStore";
import { useUIStore } from "@/store/useUIStore";
import { dateISO } from "@/lib/utils";

const CHANNELS = ["SEO", "PPC", "Social", "Email"];
const TYPES = ["Lead Gen", "Awareness", "Retargeting", "Launch"];

export default function AddCampaignModal() {
  const closeModal = useUIStore((s) => s.closeModal);
  const addCampaign = useAppStore((s) => s.addCampaign);

  const [name, setName] = useState("New Lead Campaign");
  const [channel, setChannel] = useState(CHANNELS[0]);
  const [campaignType, setCampaignType] = useState(TYPES[0]);
  const [startDate, setStartDate] = useState(dateISO(new Date()));
  const [endDate, setEndDate] = useState(dateISO(new Date()));
  const [spend, setSpend] = useState(5000);
  const [impressions, setImpressions] = useState(40000);
  const [clicks, setClicks] = useState(2500);
  const [leads, setLeads] = useState(120);
  const [revenue, setRevenue] = useState(15000);

  const save = async () => {
    await addCampaign({
      name,
      channel,
      campaignType,
      startDate,
      endDate,
      spend: Number(spend),
      impressions: Number(impressions),
      clicks: Number(clicks),
      conversions: Number(leads),
      revenue: Number(revenue),
    });
    closeModal();
  };

  return (
    <Modal title="Add Marketing Campaign" onClose={closeModal}>
      <div className="form-grid">
        <div className="field">
          <label>Campaign Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>Channel</label>
          <select value={channel} onChange={(e) => setChannel(e.target.value)}>
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Campaign Type</label>
          <select value={campaignType} onChange={(e) => setCampaignType(e.target.value)}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Start Date</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="field">
          <label>End Date</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <div className="field">
          <label>Spend</label>
          <input type="number" value={spend} onChange={(e) => setSpend(Number(e.target.value))} />
        </div>
        <div className="field">
          <label>Impressions</label>
          <input type="number" value={impressions} onChange={(e) => setImpressions(Number(e.target.value))} />
        </div>
        <div className="field">
          <label>Clicks</label>
          <input type="number" value={clicks} onChange={(e) => setClicks(Number(e.target.value))} />
        </div>
        <div className="field">
          <label>Leads</label>
          <input type="number" value={leads} onChange={(e) => setLeads(Number(e.target.value))} />
        </div>
        <div className="field">
          <label>Revenue</label>
          <input type="number" value={revenue} onChange={(e) => setRevenue(Number(e.target.value))} />
        </div>
        <button className="btn primary" onClick={save}>
          Save Campaign
        </button>
      </div>
    </Modal>
  );
}
