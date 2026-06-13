import { BrainDumpItem, DbSchema, ItemCanonicalMeta, ItemMeta, Skill, Wallet } from '../types';
import { consolidateCanonicalRules } from './canonicalization/learnedRules';

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

const pickField = <T>(localValue: T, remoteValue: T, baseValue: T): T => {
    const localChanged = !same(localValue, baseValue);
    const remoteChanged = !same(remoteValue, baseValue);
    if (remoteChanged && !localChanged) return remoteValue;
    return localValue;
};

const mergeCanonicalMeta = (
    localCanonical: ItemCanonicalMeta | undefined,
    remoteCanonical: ItemCanonicalMeta | undefined,
    baseCanonical: ItemCanonicalMeta | undefined
): ItemCanonicalMeta | undefined => {
    const merged: ItemCanonicalMeta = {};
    const fields = new Set([
        ...Object.keys(localCanonical || {}),
        ...Object.keys(remoteCanonical || {}),
        ...Object.keys(baseCanonical || {}),
    ] as Array<keyof ItemCanonicalMeta>);

    fields.forEach(field => {
        const selected = pickField(localCanonical?.[field], remoteCanonical?.[field], baseCanonical?.[field]);
        if (selected) merged[field] = selected as any;
    });

    return Object.keys(merged).length > 0 ? merged : undefined;
};

const mergeItemMeta = (localMeta: ItemMeta = {}, remoteMeta: ItemMeta = {}, baseMeta: ItemMeta = {}): ItemMeta => {
    const merged: ItemMeta = {};
    const keys = new Set([...Object.keys(localMeta), ...Object.keys(remoteMeta), ...Object.keys(baseMeta)] as Array<keyof ItemMeta>);

    keys.forEach(key => {
        if (key === 'canonical') return;
        const selected = pickField(localMeta[key], remoteMeta[key], baseMeta[key]);
        if (selected !== undefined) (merged as Record<string, unknown>)[key] = selected;
    });

    const canonical = mergeCanonicalMeta(localMeta.canonical, remoteMeta.canonical, baseMeta.canonical);
    if (canonical) merged.canonical = canonical;

    return merged;
};

const mergeConcurrentItem = (localItem: BrainDumpItem, remoteItem: BrainDumpItem, baseItem?: BrainDumpItem): BrainDumpItem => {
    if (!baseItem) return localItem;

    const localChanged = !same(localItem, baseItem);
    const remoteChanged = !same(remoteItem, baseItem);
    if (!localChanged || !remoteChanged) return localItem;

    return {
        id: localItem.id,
        type: pickField(localItem.type, remoteItem.type, baseItem.type),
        content: pickField(localItem.content, remoteItem.content, baseItem.content),
        status: pickField(localItem.status, remoteItem.status, baseItem.status),
        created_at: pickField(localItem.created_at, remoteItem.created_at, baseItem.created_at),
        completed_at: pickField(localItem.completed_at, remoteItem.completed_at, baseItem.completed_at),
        isOptimistic: pickField(localItem.isOptimistic, remoteItem.isOptimistic, baseItem.isOptimistic),
        meta: mergeItemMeta(localItem.meta, remoteItem.meta, baseItem.meta),
    };
};

const mergeConcurrentSkill = (localSkill: Skill, remoteSkill: Skill, baseSkill?: Skill): Skill => {
    if (!baseSkill) return localSkill;
    const localChanged = !same(localSkill, baseSkill);
    const remoteChanged = !same(remoteSkill, baseSkill);
    if (!localChanged || !remoteChanged) return localChanged ? localSkill : remoteSkill;
    return {
        id: localSkill.id,
        name: pickField(localSkill.name, remoteSkill.name, baseSkill.name),
        color: pickField(localSkill.color, remoteSkill.color, baseSkill.color),
        created_at: pickField(localSkill.created_at, remoteSkill.created_at, baseSkill.created_at),
        weeklyTargetMinutes: pickField(localSkill.weeklyTargetMinutes, remoteSkill.weeklyTargetMinutes, baseSkill.weeklyTargetMinutes),
    };
};

const mergeConcurrentWallet = (localWallet: Wallet, remoteWallet: Wallet, baseWallet?: Wallet): Wallet => {
    if (!baseWallet) return localWallet;
    const localChanged = !same(localWallet, baseWallet);
    const remoteChanged = !same(remoteWallet, baseWallet);
    if (!localChanged || !remoteChanged) return localChanged ? localWallet : remoteWallet;
    return {
        id: localWallet.id,
        name: pickField(localWallet.name, remoteWallet.name, baseWallet.name),
        type: pickField(localWallet.type, remoteWallet.type, baseWallet.type),
        initialBalance: pickField(localWallet.initialBalance, remoteWallet.initialBalance, baseWallet.initialBalance),
        color: pickField(localWallet.color, remoteWallet.color, baseWallet.color),
    };
};

// Helper for merging data (3-way merge to handle deletions correctly)
export const mergeDbData = (local: DbSchema, remote: DbSchema, base?: DbSchema): DbSchema => {
    const baseItemIds = new Set(base?.data.map(i => i.id) || []);
    const localItemIds = new Set(local.data.map(i => i.id));
    const remoteItemIds = new Set(remote.data.map(i => i.id));

    const itemMap = new Map<string, BrainDumpItem>();

    // 1. Items from Remote
    remote.data.forEach(remoteItem => {
        if (localItemIds.has(remoteItem.id)) {
            // In both: merge concurrent field-level changes so background enrichment can
            // round-trip without clobbering remote/manual edits made on the same row.
            const localItem = local.data.find(i => i.id === remoteItem.id)!;
            const baseItem = base?.data.find(i => i.id === remoteItem.id);
            itemMap.set(remoteItem.id, mergeConcurrentItem(localItem, remoteItem, baseItem));
        } else {
            // In remote but not in local
            if (baseItemIds.has(remoteItem.id)) {
                // Was in base, now gone in local -> DELETED locally.
                // Do not add back.
            } else {
                // Not in base -> NEW in remote.
                itemMap.set(remoteItem.id, remoteItem);
            }
        }
    });

    // 2. Items from Local
    local.data.forEach(localItem => {
        if (!remoteItemIds.has(localItem.id)) {
            // In local but not in remote
            if (baseItemIds.has(localItem.id)) {
                // Was in base, now gone in remote -> DELETED remotely.
                // Do not add back.
            } else if (base && base.data.length > 0) {
                // Base exists. Check if this item was in the base snapshot.
                if (baseItemIds.has(localItem.id)) {
                    // Was in base, now absent from remote → deleted remotely.
                    // But verify the relevant sheet was actually fetched (same-type guard).
                    const sameTypeInRemote = remote.data.some(r => r.type === localItem.type);
                    if (!sameTypeInRemote) {
                        // Sheet not fetched for this type — keep the local copy.
                        itemMap.set(localItem.id, localItem);
                    }
                    // If sameTypeInRemote: sheet was fetched and item is absent → deleted. Skip.
                } else {
                    // NOT in base → this is a genuinely new local item. Always keep.
                    itemMap.set(localItem.id, localItem);
                }
            } else {
                // No base (first sync) -> NEW in local.
                itemMap.set(localItem.id, localItem);
            }
        }
    });

    // Skills
    const baseSkillIds = new Set(base?.skills?.map(s => s.id) || []);
    const localSkillIds = new Set(local.skills?.map(s => s.id) || []);
    const remoteSkillIds = new Set(remote.skills?.map(s => s.id) || []);
    const skillMap = new Map<string, Skill>();

    remote.skills?.forEach(s => {
        if (localSkillIds.has(s.id)) {
            const localSkill = local.skills?.find(ls => ls.id === s.id);
            const baseSkill = base?.skills?.find(bs => bs.id === s.id);
            skillMap.set(s.id, localSkill ? mergeConcurrentSkill(localSkill, s, baseSkill) : s);
        } else if (!baseSkillIds.has(s.id)) {
            skillMap.set(s.id, s);
        }
    });
    local.skills?.forEach(s => {
        if (!remoteSkillIds.has(s.id) && !baseSkillIds.has(s.id)) {
            skillMap.set(s.id, s);
        }
    });

    // Wallets
    const baseWalletIds = new Set(base?.wallets?.map(w => w.id) || []);
    const localWalletIds = new Set(local.wallets?.map(w => w.id) || []);
    const remoteWalletIds = new Set(remote.wallets?.map(w => w.id) || []);
    const walletMap = new Map<string, Wallet>();

    remote.wallets?.forEach(w => {
        if (localWalletIds.has(w.id)) {
            const localWallet = local.wallets?.find(lw => lw.id === w.id);
            const baseWallet = base?.wallets?.find(bw => bw.id === w.id);
            walletMap.set(w.id, localWallet ? mergeConcurrentWallet(localWallet, w, baseWallet) : w);
        } else if (!baseWalletIds.has(w.id)) {
            walletMap.set(w.id, w);
        }
    });
    local.wallets?.forEach(w => {
        if (!remoteWalletIds.has(w.id) && !baseWalletIds.has(w.id)) {
            walletMap.set(w.id, w);
        }
    });

    // 3. Merge other properties (LWW)
    // Merge budgetConfig rules
    const localRules = local.budgetConfig?.rules || [];
    const remoteRules = remote.budgetConfig?.rules || [];
    const ruleMap = new Map<string, any>();
    // Add remote rules first, then local rules to overwrite
    [...remoteRules, ...localRules].forEach(r => ruleMap.set(r.id, r));

    const localChat = local.chatHistory || [];
    const remoteChat = remote.chatHistory || [];
    const chatHistory = localChat.length >= remoteChat.length ? localChat : remoteChat;
    // Note: chatHistory has a 50-entry cap in validateSchema; the longer array
    // is usually the most recent from the app session, which is correct.

    const localCanonicalRules = local.canonicalRules || [];
    const remoteCanonicalRules = remote.canonicalRules || [];
    const canonicalRules = consolidateCanonicalRules([...remoteCanonicalRules, ...localCanonicalRules]);

    return {
        data: Array.from(itemMap.values()),
        budgetConfig: {
            monthlyIncome: local.budgetConfig?.monthlyIncome ?? remote.budgetConfig?.monthlyIncome ?? 0,
            rules: Array.from(ruleMap.values())
        },
        appSettings: local.appSettings || remote.appSettings,
        customPrompt: local.customPrompt || remote.customPrompt,
        skills: Array.from(skillMap.values()),
        wallets: Array.from(walletMap.values()),
        monthlyThemes: { ...remote.monthlyThemes, ...local.monthlyThemes },
        monthlyThemeImages: { ...remote.monthlyThemeImages, ...local.monthlyThemeImages },
        chatHistory: chatHistory.slice(-50),
        canonicalRules
    };
};
