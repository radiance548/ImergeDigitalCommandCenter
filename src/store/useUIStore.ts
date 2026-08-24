import { create } from "zustand";

export type ModalKey =
  | "addTransaction"
  | "addTimeEntry"
  | "addDeal"
  | "addCampaign"
  | "addHealthRecord"
  | "addClient"
  | "addCustomer"
  | null;

interface UIState {
  activeModal: ModalKey;
  openModal: (key: Exclude<ModalKey, null>) => void;
  closeModal: () => void;

  /** The currently visible dashboard's filtered rows, kept in sync by each
   *  view so the shared Topbar "CSV" button can export exactly what's on screen. */
  exportRows: Record<string, unknown>[];
  setExportRows: (rows: Record<string, unknown>[]) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeModal: null,
  openModal: (key) => set({ activeModal: key }),
  closeModal: () => set({ activeModal: null }),

  exportRows: [],
  setExportRows: (rows) => set({ exportRows: rows }),
}));
