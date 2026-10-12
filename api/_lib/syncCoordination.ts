import { createHash, randomUUID } from 'node:crypto';
export type RedisCommand = (command: (string | number)[]) => Promise<any>;
const settings = () => ({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
});
export const hasSharedCoordination = () =>
  !!(settings().url && settings().token);
export class QuotaDeferred extends Error {
  constructor(public retryAfterSeconds = 60) {
    super(
      'Kuota Sheets sedang dijadwalkan. Perubahan tetap aman dalam antrean.',
    );
  }
}
export const redisCommand: RedisCommand = async (command) => {
  const { url, token } = settings();
  if (!url || !token || new URL(url).protocol !== 'https:')
    throw new Error('Shared sync storage is not configured');
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(8000),
  });
  const data = await response.json();
  if (!response.ok || data.error)
    throw new Error('Shared sync storage is unavailable');
  return data.result;
};
const memory = new Map<string, { value: string; expires: number }>();
export const hashKey = (value: string) =>
  createHash('sha256').update(value).digest('hex');
export const scopeKey = (scope: string) => `arkaiv:sync:v4:{${hashKey(scope)}}`;
export class SyncCache {
  constructor(private command?: RedisCommand) {}
  get shared() {
    return !!this.command || hasSharedCoordination();
  }
  private run(command: (string | number)[]) {
    return (this.command || redisCommand)(command);
  }
  async get<T>(key: string): Promise<T | undefined> {
    const raw = this.shared
      ? await this.run(['GET', key])
      : (() => {
          const entry = memory.get(key);
          if (entry && entry.expires > Date.now()) return entry.value;
          memory.delete(key);
        })();
    return raw == null ? undefined : JSON.parse(raw);
  }
  async set(key: string, value: unknown, seconds: number) {
    const raw = JSON.stringify(value);
    if (this.shared) await this.run(['SET', key, raw, 'EX', seconds]);
    else {
      if (memory.size >= 1000) memory.delete(memory.keys().next().value!);
      memory.set(key, { value: raw, expires: Date.now() + seconds * 1000 });
    }
  }
  async getMany<T>(keys: string[]): Promise<(T | undefined)[]> {
    if (!keys.length) return [];
    if (!this.shared) return Promise.all(keys.map((key) => this.get<T>(key)));
    const values = await this.run(['MGET', ...keys]);
    return values.map((raw: string | null) =>
      raw == null ? undefined : JSON.parse(raw),
    );
  }
  async setMany(
    entries: { key: string; value: unknown }[],
    seconds: number,
    onlyMissing = false,
  ) {
    if (!entries.length) return;
    if (!this.shared) {
      for (const entry of entries) {
        if (!onlyMissing || !(await this.get(entry.key)))
          await this.set(entry.key, entry.value, seconds);
      }
      return;
    }
    await this.run([
      'EVAL',
      `for i,key in ipairs(KEYS) do if ARGV[1]=='1' then redis.call('SET',key,ARGV[i+2],'EX',ARGV[2],'NX') else redis.call('SET',key,ARGV[i+2],'EX',ARGV[2]) end end return #KEYS`,
      entries.length,
      ...entries.map((entry) => entry.key),
      onlyMissing ? '1' : '0',
      seconds,
      ...entries.map((entry) => JSON.stringify(entry.value)),
    ]);
  }
  async lock(key: string, seconds = 30): Promise<string | undefined> {
    const owner = randomUUID();
    if (this.shared)
      return (await this.run(['SET', key, owner, 'NX', 'EX', seconds])) === 'OK'
        ? owner
        : undefined;
    const existing = memory.get(key);
    if (existing && existing.expires > Date.now()) return;
    memory.set(key, { value: owner, expires: Date.now() + seconds * 1000 });
    return owner;
  }
  async unlock(key: string, owner: string) {
    if (this.shared)
      await this.run([
        'EVAL',
        "if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0",
        1,
        key,
        owner,
      ]);
    else if (memory.get(key)?.value === owner) memory.delete(key);
  }
  async changed(scope: string, tables: string[]) {
    const key = `${scopeKey(scope)}:version`;
    if (this.shared) {
      await this.run([
        'EVAL',
        `local raw=redis.call('GET',KEYS[1]); local state=raw and cjson.decode(raw) or {revision=0,tables={}}; state.revision=state.revision+1; local seen={}; for _,v in ipairs(state.tables) do seen[v]=true end; for _,v in ipairs(cjson.decode(ARGV[1])) do if not seen[v] then table.insert(state.tables,v); seen[v]=true end end; redis.call('SET',KEYS[1],cjson.encode(state),'EX',604800); return state.revision`,
        1,
        key,
        JSON.stringify(tables),
      ]);
    } else {
      const state = (await this.get<{ revision: number; tables: string[] }>(
        key,
      )) || { revision: 0, tables: [] };
      await this.set(
        key,
        {
          revision: state.revision + 1,
          tables: [...new Set([...state.tables, ...tables])],
        },
        604800,
      );
    }
  }
  async publish(
    scope: string,
    receipts: { operationId: string; state: string; error?: string }[],
    tables: string[],
  ) {
    const marker = `${scopeKey(scope)}:published:${hashKey(
      receipts
        .map((receipt) => receipt.operationId)
        .sort()
        .join(','),
    )}`;
    const entries = receiptEntries(scope, receipts);
    if (!this.shared) {
      await this.setMany(entries, 604800);
      if (!(await this.get(marker))) {
        if (tables.length) await this.changed(scope, tables);
        await this.set(marker, true, 604800);
      }
      return;
    }
    await this.run([
      'EVAL',
      `local raw=redis.call('GET',KEYS[2]); local state=raw and cjson.decode(raw) or {revision=0,tables={}}; if not redis.call('GET',KEYS[1]) then local tables=cjson.decode(ARGV[1]); if #tables>0 then state.revision=state.revision+1; local seen={}; for _,v in ipairs(state.tables) do seen[v]=true end; for _,v in ipairs(tables) do if not seen[v] then table.insert(state.tables,v); seen[v]=true end end; redis.call('SET',KEYS[2],cjson.encode(state),'EX',604800) end; redis.call('SET',KEYS[1],'1','EX',604800) end; for i=3,#KEYS do redis.call('SET',KEYS[i],ARGV[i-1],'EX',604800) end; return 1`,
      2 + entries.length,
      marker,
      `${scopeKey(scope)}:version`,
      ...entries.map((entry) => entry.key),
      JSON.stringify(tables),
      ...entries.map((entry) => JSON.stringify(entry.value)),
    ]);
  }
}
export const syncCache = new SyncCache();
export const receiptKey = (scope: string, id: string) =>
  `${scopeKey(scope)}:receipt:${hashKey(id)}`;
export const receiptEntries = (
  scope: string,
  receipts: { operationId: string; state: string; error?: string }[],
) =>
  receipts.map((value) => ({
    key: receiptKey(scope, value.operationId),
    value,
  }));

// One key per Google principal, shared across workbooks and deployment environments.
export const RESERVE_SCRIPT = `local time=redis.call('TIME'); local now=tonumber(time[1])*1000+math.floor(tonumber(time[2])/1000); local next=tonumber(redis.call('HGET',KEYS[1],ARGV[1]) or '0'); local cooldown=tonumber(redis.call('HGET',KEYS[1],'cooldown') or '0'); local delay=math.max(next,cooldown)-now; if delay>0 then return delay end; redis.call('HSET',KEYS[1],ARGV[1],now+tonumber(ARGV[2])); redis.call('EXPIRE',KEYS[1],3600); return 0`;
export const COOLDOWN_SCRIPT = `local time=redis.call('TIME'); local now=tonumber(time[1])*1000+math.floor(tonumber(time[2])/1000); local untilTime=math.max(tonumber(redis.call('HGET',KEYS[1],'cooldown') or '0'),now+tonumber(ARGV[1])); redis.call('HSET',KEYS[1],'cooldown',untilTime); redis.call('EXPIRE',KEYS[1],3600); return untilTime`;
const localQuota = new Map<string, Record<string, number>>();
export async function reserveSheetsRequest(
  principal: string,
  kind: 'read' | 'write',
  signal?: AbortSignal,
  command?: RedisCommand,
) {
  const key = `arkaiv:google-quota:${hashKey(principal)}`;
  const perMinute = Math.min(
    40,
    Math.max(1, Number(process.env.SHEETS_REQUESTS_PER_MINUTE) || 40),
  );
  const interval = Math.ceil(60000 / perMinute);
  const deadline = Date.now() + 10000;
  for (;;) {
    signal?.throwIfAborted();
    let delay: number;
    if (command || hasSharedCoordination())
      delay = Number(
        await (command || redisCommand)([
          'EVAL',
          RESERVE_SCRIPT,
          1,
          key,
          kind,
          interval,
        ]),
      );
    else {
      const state = localQuota.get(key) || {};
      const now = Date.now();
      delay = Math.max(state[kind] || 0, state.cooldown || 0) - now;
      if (delay <= 0) {
        state[kind] = now + interval;
        localQuota.set(key, state);
      }
    }
    if (delay <= 0) return;
    if (Date.now() + delay > deadline)
      throw new QuotaDeferred(Math.ceil(delay / 1000));
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', abort);
        resolve();
      }, delay);
      const abort = () => {
        clearTimeout(timer);
        reject(signal?.reason);
      };
      signal?.addEventListener('abort', abort, { once: true });
    });
  }
}
export async function sheetsCooldown(
  principal: string,
  seconds: number,
  command?: RedisCommand,
) {
  const key = `arkaiv:google-quota:${hashKey(principal)}`;
  if (command || hasSharedCoordination())
    await (command || redisCommand)([
      'EVAL',
      COOLDOWN_SCRIPT,
      1,
      key,
      Math.max(60, seconds) * 1000,
    ]);
  else {
    const state = localQuota.get(key) || {};
    state.cooldown = Math.max(
      state.cooldown || 0,
      Date.now() + Math.max(60, seconds) * 1000,
    );
    localQuota.set(key, state);
  }
}
