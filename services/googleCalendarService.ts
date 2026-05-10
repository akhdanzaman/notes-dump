import { AppSettings, BrainDumpItem, ItemType } from '../types';
import { getValidGoogleAccessToken } from './googleProfileService';
import { getShoppingDueDate } from '../utils/shoppingDateUtils';

export interface GoogleCalendarSyncEvent {
  itemId: string;
  summary: string;
  description: string;
  start: { date?: string; dateTime?: string };
  end: { date?: string; dateTime?: string };
  recurrence?: string[];
  extendedProperties: {
    private: {
      arkaivSource: 'arkaiv';
      arkaivItemId: string;
    };
  };
}

interface GoogleCalendarEventListItem {
  id: string;
  extendedProperties?: {
    private?: Record<string, string>;
  };
}

export interface GoogleCalendarSyncResult {
  created: number;
  updated: number;
  deleted: number;
  skipped: number;
}

const GOOGLE_CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3/calendars';

const isSyncableCalendarItem = (item: BrainDumpItem): boolean => {
  if (![ItemType.TODO, ItemType.EVENT, ItemType.SHOPPING].includes(item.type)) return false;
  if (item.meta.hideFromCalendar) return false;
  return Boolean(item.meta.start || item.meta.date || item.meta.dateTime || getShoppingDueDate(item));
};

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const addMinutes = (date: Date, minutes: number): Date => {
  const next = new Date(date);
  next.setMinutes(next.getMinutes() + minutes);
  return next;
};

const toCalendarDate = (value: string | Date): string => {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
};

const toDateTime = (value: string | Date): string => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
};

const hasExplicitTime = (value?: string): boolean => Boolean(value && /T\d{2}:\d{2}/.test(value));

const buildRecurrence = (item: BrainDumpItem): string[] | undefined => {
  const interval = item.meta.routineInterval;
  if (interval === 'daily') return ['RRULE:FREQ=DAILY'];
  if (interval === 'weekly') {
    const dayNames = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
    const days = item.meta.routineDaysOfWeek?.map(day => dayNames[day]).filter(Boolean);
    return [`RRULE:FREQ=WEEKLY${days?.length ? `;BYDAY=${days.join(',')}` : ''}`];
  }
  if (interval === 'monthly') {
    const days = item.meta.routineDaysOfMonth?.filter(day => day >= 1 && day <= 31);
    return [`RRULE:FREQ=MONTHLY${days?.length ? `;BYMONTHDAY=${days.join(',')}` : ''}`];
  }
  if (interval === 'yearly') {
    const months = item.meta.routineMonthsOfYear?.map(month => month + 1).filter(month => month >= 1 && month <= 12);
    const days = item.meta.routineDaysOfMonth?.filter(day => day >= 1 && day <= 31);
    const pieces = ['RRULE:FREQ=YEARLY'];
    if (months?.length) pieces.push(`BYMONTH=${months.join(',')}`);
    if (days?.length) pieces.push(`BYMONTHDAY=${days.join(',')}`);
    return [pieces.join(';')];
  }
  if (item.meta.recurrenceDays && item.meta.recurrenceDays > 0) {
    return [`RRULE:FREQ=DAILY;INTERVAL=${item.meta.recurrenceDays}`];
  }
  return undefined;
};

const eventTypeLabel = (item: BrainDumpItem): string => {
  if (item.type === ItemType.EVENT) return 'Event';
  if (item.type === ItemType.SHOPPING) return 'Shopping';
  return 'Todo';
};

export const buildGoogleCalendarEvents = (items: BrainDumpItem[]): GoogleCalendarSyncEvent[] => {
  return items.filter(isSyncableCalendarItem).map(item => {
    const title = item.meta.title || item.content || eventTypeLabel(item);
    const summary = `${item.status === 'done' ? '✅ ' : ''}${title}`;
    const sourceDate = item.type === ItemType.SHOPPING
      ? getShoppingDueDate(item)
      : (item.meta.date || item.meta.dateTime);
    const startValue = item.meta.start || sourceDate || item.created_at;
    const endValue = item.meta.end;
    const useTimedEvent = hasExplicitTime(item.meta.start) || hasExplicitTime(item.meta.dateTime);

    const start = useTimedEvent
      ? { dateTime: toDateTime(startValue) }
      : { date: toCalendarDate(startValue) };

    const end = useTimedEvent
      ? { dateTime: toDateTime(endValue || addMinutes(new Date(startValue), 60)) }
      : { date: toCalendarDate(addDays(new Date(startValue), 1)) };

    return {
      itemId: item.id,
      summary,
      description: [
        `Synced from Arkaiv (${eventTypeLabel(item)})`,
        `Status: ${item.status}`,
        item.meta.priority ? `Priority: ${item.meta.priority}` : undefined,
        item.meta.tags?.length ? `Tags: ${item.meta.tags.join(', ')}` : undefined,
        '',
        item.content,
      ].filter(Boolean).join('\n'),
      start,
      end,
      recurrence: buildRecurrence(item),
      extendedProperties: {
        private: {
          arkaivSource: 'arkaiv',
          arkaivItemId: item.id,
        },
      },
    };
  });
};

const calendarFetch = async (calendarId: string, path: string, init: RequestInit = {}): Promise<Response> => {
  const token = await getValidGoogleAccessToken();
  if (!token) {
    throw new Error('Google account is not connected. Sign in with Google before enabling Calendar sync.');
  }
  return fetch(`${GOOGLE_CALENDAR_API_BASE}/${encodeURIComponent(calendarId)}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
};

const readResponseText = async (response: Response): Promise<string> => {
  try { return await response.text(); } catch { return response.statusText; }
};

const toCalendarApiEvent = (event: GoogleCalendarSyncEvent) => {
  return {
    summary: event.summary,
    description: event.description,
    start: event.start,
    end: event.end,
    recurrence: event.recurrence,
    extendedProperties: event.extendedProperties,
  };
};

const listExistingArkaivEvents = async (calendarId: string): Promise<GoogleCalendarEventListItem[]> => {
  const events: GoogleCalendarEventListItem[] = [];
  let pageToken = '';
  do {
    const query = new URLSearchParams({
      privateExtendedProperty: 'arkaivSource=arkaiv',
      maxResults: '2500',
      showDeleted: 'false',
      singleEvents: 'false',
    });
    if (pageToken) query.set('pageToken', pageToken);
    const response = await calendarFetch(calendarId, `/events?${query.toString()}`);
    if (!response.ok) {
      throw new Error(`Google Calendar list failed: ${response.status} ${await readResponseText(response)}`);
    }
    const data = await response.json();
    events.push(...(data.items || []));
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return events;
};

export const syncItemsToGoogleCalendar = async (
  items: BrainDumpItem[],
  settings: Pick<AppSettings, 'googleCalendarSyncEnabled' | 'googleCalendarId'>,
): Promise<GoogleCalendarSyncResult> => {
  if (!settings.googleCalendarSyncEnabled) {
    return { created: 0, updated: 0, deleted: 0, skipped: items.length };
  }

  const calendarId = (settings.googleCalendarId || 'primary').trim() || 'primary';
  const desiredEvents = buildGoogleCalendarEvents(items);
  const desiredByItemId = new Map(desiredEvents.map(event => [event.itemId, event]));
  const existingEvents = await listExistingArkaivEvents(calendarId);
  const existingByItemId = new Map<string, GoogleCalendarEventListItem>();
  existingEvents.forEach(event => {
    const itemId = event.extendedProperties?.private?.arkaivItemId;
    if (itemId) existingByItemId.set(itemId, event);
  });

  let created = 0;
  let updated = 0;
  let deleted = 0;

  for (const event of desiredEvents) {
    const existing = existingByItemId.get(event.itemId);
    if (existing?.id) {
      const response = await calendarFetch(calendarId, `/events/${encodeURIComponent(existing.id)}`, {
        method: 'PATCH',
        body: JSON.stringify(toCalendarApiEvent(event)),
      });
      if (!response.ok) throw new Error(`Google Calendar update failed: ${response.status} ${await readResponseText(response)}`);
      updated += 1;
    } else {
      const response = await calendarFetch(calendarId, '/events', {
        method: 'POST',
        body: JSON.stringify(toCalendarApiEvent(event)),
      });
      if (!response.ok) throw new Error(`Google Calendar create failed: ${response.status} ${await readResponseText(response)}`);
      created += 1;
    }
  }

  for (const event of existingEvents) {
    const itemId = event.extendedProperties?.private?.arkaivItemId;
    if (!event.id || !itemId || desiredByItemId.has(itemId)) continue;
    const response = await calendarFetch(calendarId, `/events/${encodeURIComponent(event.id)}`, { method: 'DELETE' });
    if (!response.ok && response.status !== 410 && response.status !== 404) {
      throw new Error(`Google Calendar delete failed: ${response.status} ${await readResponseText(response)}`);
    }
    deleted += 1;
  }

  return { created, updated, deleted, skipped: items.length - desiredEvents.length };
};
