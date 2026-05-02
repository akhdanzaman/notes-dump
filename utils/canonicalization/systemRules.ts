import { CanonicalRule, Wallet } from '../../types';
import { normalizeCanonicalText, normalizeWalletText } from './normalize';

const now = '2026-05-02T00:00:00.000Z';

const baseRules: CanonicalRule[] = [
  {
    id: 'system-subcommodity-breakfast',
    field: 'subcommodity',
    canonicalValue: 'breakfast',
    aliases: ['sarapan', 'makan pagi', 'breakfast'],
    source: 'system',
    confidenceBoost: 0.1,
    approvalCount: 999,
    rejectionCount: 0,
    conditions: { financeType: ['expense'], commodity: ['food'] },
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'system-subcommodity-lunch',
    field: 'subcommodity',
    canonicalValue: 'lunch',
    aliases: ['makan siang', 'lunch'],
    source: 'system',
    confidenceBoost: 0.08,
    approvalCount: 999,
    rejectionCount: 0,
    conditions: { financeType: ['expense'], commodity: ['food'] },
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'system-subcommodity-dinner',
    field: 'subcommodity',
    canonicalValue: 'dinner',
    aliases: ['makan malam', 'dinner'],
    source: 'system',
    confidenceBoost: 0.08,
    approvalCount: 999,
    rejectionCount: 0,
    conditions: { financeType: ['expense'], commodity: ['food'] },
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'system-subcommodity-parking',
    field: 'subcommodity',
    canonicalValue: 'parking',
    aliases: ['parkir', 'parking'],
    source: 'system',
    confidenceBoost: 0.08,
    approvalCount: 999,
    rejectionCount: 0,
    conditions: { financeType: ['expense'], commodity: ['transport'] },
    createdAt: now,
    updatedAt: now,
  },
];

const buildWalletAliases = (wallet: Wallet): string[] => {
  const aliases = new Set<string>();
  aliases.add(wallet.name);

  const normalized = normalizeWalletText(wallet.name);
  if (normalized) aliases.add(normalized);

  const plain = normalizeCanonicalText(wallet.name);
  if (plain) aliases.add(plain);

  return Array.from(aliases).filter(Boolean);
};

export const getSystemCanonicalRules = (wallets: Wallet[] = []): CanonicalRule[] => {
  const walletRules: CanonicalRule[] = wallets.map((wallet) => ({
    id: `system-wallet-${wallet.id}`,
    field: 'paymentMethod',
    canonicalValue: wallet.id,
    aliases: buildWalletAliases(wallet),
    source: 'system',
    confidenceBoost: 0.05,
    approvalCount: 999,
    rejectionCount: 0,
    createdAt: now,
    updatedAt: now,
  }));

  return [...baseRules, ...walletRules];
};
