import { useAppStore } from "@/store/useAppStore";
import { money as formatMoney } from "@/lib/utils";

export function useMoney() {
  const currency = useAppStore((s) => s.data?.settings.currency || "$");
  return (n: number | undefined) => formatMoney(currency, n);
}
