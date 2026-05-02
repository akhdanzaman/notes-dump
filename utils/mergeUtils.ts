import { BrainDumpItem, DbSchema, Skill, Wallet } from '../types';

// Helper for merging data (3-way merge to handle deletions correctly)
export const mergeDbData = (local: DbSchema, remote: DbSchema, base?: DbSchema): DbSchema => {
    const baseItemIds = new Set(base?.data.map(i => i.id) || []);
    const localItemIds = new Set(local.data.map(i => i.id));
    const remoteItemIds = new Set(remote.data.map(i => i.id));

    const itemMap = new Map<string, BrainDumpItem>();

    // 1. Items from Remote
    remote.data.forEach(remoteItem => {
        if (localItemIds.has(remoteItem.id)) {
            // In both: Local wins (LWW) to preserve current session edits
            const localItem = local.data.find(i => i.id === remoteItem.id)!;
            itemMap.set(remoteItem.id, localItem);
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
            } else {
                // Not in base -> NEW in local.
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
            skillMap.set(s.id, local.skills?.find(ls => ls.id === s.id) || s);
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
            walletMap.set(w.id, local.wallets?.find(lw => lw.id === w.id) || w);
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

    const localCanonicalRules = local.canonicalRules || [];
    const remoteCanonicalRules = remote.canonicalRules || [];
    const canonicalRuleMap = new Map<string, typeof localCanonicalRules[number]>();
    [...remoteCanonicalRules, ...localCanonicalRules].forEach(rule => canonicalRuleMap.set(rule.id, rule));

    return {
        data: Array.from(itemMap.values()),
        budgetConfig: {
            monthlyIncome: local.budgetConfig?.monthlyIncome || remote.budgetConfig?.monthlyIncome || 0,
            rules: Array.from(ruleMap.values())
        },
        appSettings: local.appSettings || remote.appSettings,
        customPrompt: local.customPrompt || remote.customPrompt,
        skills: Array.from(skillMap.values()),
        wallets: Array.from(walletMap.values()),
        monthlyThemes: { ...remote.monthlyThemes, ...local.monthlyThemes },
        chatHistory: chatHistory.slice(-50),
        canonicalRules: Array.from(canonicalRuleMap.values())
    };
};
