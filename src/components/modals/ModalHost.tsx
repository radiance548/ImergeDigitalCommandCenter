"use client";

import { useUIStore } from "@/store/useUIStore";
import AddTransactionModal from "./AddTransactionModal";
import AddTimeEntryModal from "./AddTimeEntryModal";
import AddDealModal from "./AddDealModal";
import AddCampaignModal from "./AddCampaignModal";
import AddHealthRecordModal from "./AddHealthRecordModal";
import AddClientModal from "./AddClientModal";
import AddCustomerModal from "./AddCustomerModal";

export default function ModalHost() {
  const activeModal = useUIStore((s) => s.activeModal);

  switch (activeModal) {
    case "addTransaction":
      return <AddTransactionModal />;
    case "addTimeEntry":
      return <AddTimeEntryModal />;
    case "addDeal":
      return <AddDealModal />;
    case "addCampaign":
      return <AddCampaignModal />;
    case "addHealthRecord":
      return <AddHealthRecordModal />;
    case "addClient":
      return <AddClientModal />;
    case "addCustomer":
      return <AddCustomerModal />;
    default:
      return null;
  }
}
