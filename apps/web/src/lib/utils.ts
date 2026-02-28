import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { tr, localeFormats } from '@/lib/i18n';
import { useLocaleStore } from '@/stores/locale.store';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function getLocaleConfig() {
  const locale = useLocaleStore.getState().locale;
  return localeFormats[locale];
}

export function formatDkp(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  const { locale } = getLocaleConfig();
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(num);
}

export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const cfg = getLocaleConfig();
  return d.toLocaleDateString(cfg.locale, {
    timeZone: cfg.timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...options,
  });
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const cfg = getLocaleConfig();
  return d.toLocaleString(cfg.locale, {
    timeZone: cfg.timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTimeAgo(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return tr('time.justNow');
  if (diffMin < 60) return tr('time.minAgo', { count: diffMin });
  if (diffHr < 24) return tr('time.hrAgo', { count: diffHr });
  if (diffDay < 7) return tr('time.dayAgo', { count: diffDay });
  return formatDate(d);
}

export function getRarityClass(rarity: string): string {
  const map: Record<string, string> = {
    MYTHIC: 'rarity-mythic',
    LEGENDARY: 'rarity-legendary',
    EPIC: 'rarity-epic',
    RARE: 'rarity-rare',
    UNCOMMON: 'rarity-uncommon',
    COMMON: 'rarity-common',
  };
  return map[rarity] || 'rarity-common';
}

export function getRarityBgClass(rarity: string): string {
  const map: Record<string, string> = {
    MYTHIC: 'rarity-bg-mythic',
    LEGENDARY: 'rarity-bg-legendary',
    EPIC: 'rarity-bg-epic',
    RARE: 'rarity-bg-rare',
    UNCOMMON: 'rarity-bg-uncommon',
    COMMON: 'rarity-bg-common',
  };
  return map[rarity] || 'rarity-bg-common';
}

export function getRarityLabel(rarity: string): string {
  const key = `label.rarity.${rarity}`;
  const label = tr(key);
  return label === key ? rarity : label;
}

export function getRoleLabel(role: string): string {
  const key = `label.role.${role}`;
  const label = tr(key);
  return label === key ? role : label;
}

export function getStatusLabel(status: string): string {
  const key = `label.status.${status}`;
  const label = tr(key);
  return label === key ? status : label;
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    DRAFT: 'text-gray-400',
    OPEN: 'text-blue-400',
    IN_PROGRESS: 'text-yellow-400',
    COMPLETED: 'text-green-400',
    CANCELLED: 'text-red-400',
    ACTIVE: 'text-green-400',
    PAUSED: 'text-orange-400',
    PENDING: 'text-yellow-400',
    SOLD: 'text-green-400',
    UNSOLD: 'text-gray-400',
  };
  return map[status] || 'text-gray-400';
}

