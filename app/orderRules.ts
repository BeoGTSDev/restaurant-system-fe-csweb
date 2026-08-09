// Web support code used by the main page.
// Small customer display rules live here so they are easy to test; backend rules are final.
import type { Language } from "./i18n";

export type MenuProduct = {
  name: string;
  displayName?: string | null;
  status: string;
  remainingQty?: number | null;
};

const locales: Record<Language, string> = {
  en: "en-US", vi: "vi-VN", fr: "fr-FR", zh: "zh-CN",
  ja: "ja-JP", ko: "ko-KR", th: "th-TH", ru: "ru-RU"
};

export const formatMoney = (value: number, language: Language = "en") =>
  new Intl.NumberFormat(locales[language], {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0
  }).format(Number(value || 0));

export const displayProductName = (product: MenuProduct) => product.displayName || product.name;

export const isVisibleMenuProduct = (product: MenuProduct) => product.status !== "Disabled";

export const menuAvailabilityRank = (product: MenuProduct) =>
  product.status === "Out of Stock" || product.remainingQty === 0
    ? 2
    : product.remainingQty != null ? 1 : 0;

export const isSessionExpired = (
  lastActivityAt: number,
  now = Date.now(),
  timeoutMs = 5 * 60 * 1000
) => now - lastActivityAt >= timeoutMs;
