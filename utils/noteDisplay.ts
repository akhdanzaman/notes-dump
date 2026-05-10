import { BrainDumpItem } from '../types';

const normalizePreview = (value: string) => value.replace(/\s+/g, ' ').trim();
const stripMarkdownHeading = (value: string) => value.replace(/^#{1,6}\s+/, '').trim();

const contentLines = (content: string) => content
  .split(/\r?\n/)
  .map(line => line.trim())
  .filter(Boolean);

export const deriveNoteTitle = (content: string, fallback = 'Untitled note') => {
  const firstLine = contentLines(content)[0];
  if (!firstLine) return fallback;
  return stripMarkdownHeading(firstLine).slice(0, 90) || fallback;
};

export const getNoteDisplayParts = (item: Pick<BrainDumpItem, 'content' | 'meta' | 'type'>) => {
  const explicitTitle = typeof item.meta?.title === 'string' ? item.meta.title.trim() : '';
  const lines = contentLines(item.content || '');
  const title = explicitTitle || deriveNoteTitle(item.content || '', item.type === 'JOURNAL' ? 'Untitled journal' : 'Untitled note');

  const previewSource = explicitTitle
    ? item.content || ''
    : lines.slice(1).join('\n') || item.content || '';

  const preview = normalizePreview(previewSource);

  return {
    title,
    preview,
    hasDedicatedTitle: Boolean(explicitTitle),
  };
};
