import { useEditorDraft } from '../hooks/useEditorDraft';
import React, { useEffect, useState } from 'react';
import { X, Check, Calendar } from 'lucide-react';
import { Priority } from '../types';
import PresencePanel from '../motion/PresencePanel';
import { addItemModal, responsiveModal } from './layout/contentSurface';
import { getLocalDateKey } from '../utils/selectors/dateUtils';

interface AddTaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (content: string, date: string, priority: Priority, start?: string, end?: string, hideFromCalendar?: boolean) => void | Promise<unknown>;
    initialDate?: string;
}

const AddTaskModal: React.FC<AddTaskModalProps> = ({ isOpen, onClose, onSave, initialDate }) => {
    const [content, setContent] = useState('');
    const [date, setDate] = useState(() => getLocalDateKey(initialDate || new Date()));
    const [start, setStart] = useState('');
    const [end, setEnd] = useState('');
    const [priority, setPriority] = useState<Priority>('normal');
    const [hideFromCalendar, setHideFromCalendar] = useState(false);

    useEffect(() => {
        if (isOpen && !draft.dirty.current) setDate(getLocalDateKey(initialDate || new Date()));
    }, [isOpen, initialDate]);

    const draft = useEditorDraft('AddTaskModal', { content, date, start, end, priority, hideFromCalendar }, v => { if (Object.hasOwn(v, 'content')) setContent(v.content); if (Object.hasOwn(v, 'date')) setDate(v.date); if (Object.hasOwn(v, 'start')) setStart(v.start); if (Object.hasOwn(v, 'end')) setEnd(v.end); if (Object.hasOwn(v, 'priority')) setPriority(v.priority); if (Object.hasOwn(v, 'hideFromCalendar')) setHideFromCalendar(v.hideFromCalendar); });
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState('');
  const timeError = end && start && new Date(end) <= new Date(start) ? 'Waktu selesai harus setelah waktu mulai.' : '';
  const handleSave = async () => {
    if (saving) return;
    setSaving(true); setSaveError('');
    try {
        if (!content.trim() || !date) return;
        if (timeError) { setSaveError(timeError); return; }

        let startIso, endIso;
        if (start) startIso = new Date(start).toISOString();
        if (end) endIso = new Date(end).toISOString();

        await onSave(content, new Date(`${date}T00:00:00`).toISOString(), priority, startIso, endIso, hideFromCalendar);
      draft.clear();
        setContent('');
        setStart('');
        setEnd('');
        setPriority('normal');
        setHideFromCalendar(false);
        onClose();

    } catch (error) { setSaveError(error instanceof Error ? error.message : 'Perubahan belum tersimpan di perangkat.'); } finally { setSaving(false); }
  };

    return (
        <PresencePanel
            isOpen={isOpen}
      protectDraft
      hasDraft={draft.dirty.current}
      onDiscardDraft={draft.clear}
      saving={saving}
      saveError={saveError}
      draftKey={'AddTaskModal'}
      onDraftChange={draft.markDirty}
            onClose={onClose}
            overlayClassName={responsiveModal.sheetOverlay}
            panelClassName={addItemModal.panel}
            presentation="form"
            closeOnBackdrop={false}
            ariaLabel="Tambah tugas"
            overlayProps={{ 'data-tablet-modal-overlay': 'add-task' }}
            panelProps={{
                'data-tablet-modal-panel': 'add-task',
                'data-ndz-tablet-baseline': 'modal',
            }}
        >
                    <div className={addItemModal.header}>
                        <h3 className={addItemModal.title}>
                            <Calendar className={addItemModal.icon} />
                            Tambah tugas
                        </h3>
                        <button data-editor-close="true" onClick={onClose} className={addItemModal.closeButton}>
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className={addItemModal.body}>
                        <div>
                            <label htmlFor="AddTaskModal-content" className={addItemModal.label}>Deskripsi tugas</label>
<input id="AddTaskModal-content"
                                type="text"
                                autoFocus
                                value={content}
                                onChange={e => setContent(e.target.value)}
                                placeholder="Apa yang perlu dikerjakan?"
                                className={addItemModal.input}
                            />
                        </div>

                        <div>
                            <label htmlFor="AddTaskModal-date" className={addItemModal.label}>Tenggat</label>
<input id="AddTaskModal-date"
                                type="date"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                className={addItemModal.input}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="AddTaskModal-start" className={addItemModal.label}>Waktu mulai</label>
<input id="AddTaskModal-start"
                                    type="datetime-local"
                                    value={start}
                                    onChange={e => setStart(e.target.value)}
                                    className={addItemModal.input}
                                />
                            </div>
                            <div>
                                <label htmlFor="AddTaskModal-end" className={addItemModal.label}>Waktu selesai</label>
<input id="AddTaskModal-end"
                                    type="datetime-local"
                                    value={end}
                                    onChange={e => setEnd(e.target.value)}
                                    className={addItemModal.input}
                                />
                            </div>
                        </div>

                        <div>
                            <label className={addItemModal.label}>Prioritas</label>
                            <div className="grid grid-cols-3 gap-2">
                                {(['low', 'normal', 'high'] as Priority[]).map(p => (
                                    <button
                                        key={{ low: "Rendah", normal: "Normal", high: "Tinggi" }[p]}
                                        aria-pressed={priority === p} onClick={() => setPriority(p)}
                                        className={`py-3 rounded-xl font-bold text-sm capitalize transition-all ${
                                            priority === p
                                                ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20'
                                                : 'bg-background border border-border text-muted hover:border-brand-500/50'
                                        }`}
                                    >
                                        {{ low: "Rendah", normal: "Normal", high: "Tinggi" }[p]}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="hideFromCalendarTask"
                                checked={hideFromCalendar}
                                onChange={(e) => setHideFromCalendar(e.target.checked)}
                                className={addItemModal.checkbox}
                            />
                            <label htmlFor="hideFromCalendarTask" className="text-sm font-medium text-primary">
                                Sembunyikan dari Kalender
                            </label>
                        </div>
                    </div>

                    <div className={addItemModal.footer}>
                        {timeError && <p role="alert" className="mb-3 text-sm text-red-600">{timeError}</p>}
                        {!content.trim() && <p className="mb-3 text-sm text-muted">Isi deskripsi tugas untuk menyimpan.</p>}
                        <button
                            onClick={handleSave}
                            disabled={saving || !content.trim() || !date || Boolean(timeError)}
                            className={addItemModal.primaryButton}
                        >
                            <Check className="w-5 h-5" />
                            Simpan tugas
                        </button>
                    </div>
        </PresencePanel>
    );
};

export default AddTaskModal;
