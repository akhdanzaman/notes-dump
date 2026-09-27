import type { Wallet } from '../types';

/** Preserve the old first-match precedence for colliding names/IDs. */
export function createWalletLookup(wallets: readonly Wallet[]) {
  const byAlias = new Map<string, Wallet>();
  const byName = new Map<string, Wallet>();
  for (const wallet of wallets) {
    const name = wallet.name.toLowerCase();
    if (!byName.has(name)) byName.set(name, wallet);
    for (const alias of [wallet.id.toLowerCase(), name]) {
      if (!byAlias.has(alias)) byAlias.set(alias, wallet);
    }
  }
  return {
    byName,
    resolve(value?: string): string {
      const normalized = value?.toLowerCase().trim() || '';
      return byAlias.get(normalized)?.name.toLowerCase() || normalized;
    },
  };
}
export type WalletLookup = ReturnType<typeof createWalletLookup>;
