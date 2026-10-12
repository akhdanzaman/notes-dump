import { useEditorDraft } from '../hooks/useEditorDraft';
import React, { useState } from 'react';
import { X, Check, StickyNote } from 'lucide-react';
import PresencePanel from '../motion/PresencePanel';
import { addItemModal, responsiveModal } from './layout/contentSurface';

interface AddNoteModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (title: string, content: string, tags: string[]) => void | Promise<unknown>;
    mode?: 'note' | 'journal';
}

const AddNoteModal: React.FC<AddNoteModalProps> = ({ isOpen, onClose, onSave, mode = 'note' }) => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [tags, setTags] = useState('');

    const isJournal = mode === 'journal';

    const draft = useEditorDraft(`note:${mode}`, { title, content, tags }, v => { if (Object.hasOwn(v, 'title')) setTitle(v.title); if (Object.hasOwn(v, 'content')) setContent(v.content); if (Object.hasOwn(v, 'tags')) setTags(v.tags); });
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState('');
  const handleSave = async () => {
    if (saving) return;
    setSaving(true); setSaveError('');
    try {
        if (!title.trim() && !content.trim()) return;
        const tagList = tags.split(',').map(t => t.trim()).filter(t => t);
        await onSave(title.trim(), content, tagList);
      draft.clear();
        setTitle('');
        setContent('');
        setTags('');
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
      draftKey={`note:${mode}`}
      onDraftChange={draft.markDirty}
            onClose={onClose}
            overlayClassName={responsiveModal.sheetOverlay}
            panelClassName={addItemModal.panel}
            presentation="form"
            closeOnBackdrop={false}
            ariaLabel={isJournal ? 'Add Journal Entry' : 'Add Note'}
            overlayProps={{ 'data-tablet-modal-overlay': 'add-note' }}
            panelProps={{
                'data-tablet-modal-panel': 'add-note',
                'data-ndz-tablet-baseline': 'modal',
            }}
        >
                    <div className={addItemModal.header}>
                        <h3 className={addItemModal.title}>
                            <StickyNote className={addItemModal.icon} />
                            {isJournal ? 'Add Journal Entry' : 'Add Note'}
                        </h3>
                        <button data-editor-close="true" onClick={onClose} className={addItemModal.closeButton}>
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className={addItemModal.body}>
                        <div>
                            <label className={addItemModal.label}>Title</label>
                            <input
                                autoFocus
                                type="text"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                placeholder={isJournal ? 'Today in one line' : 'Give this note a clear title'}
                                className={addItemModal.titleInput}
                            />
                        </div>

                        <div>
                            <label className={addItemModal.label}>Content</label>
                            <textarea 
                                value={content}
                                onChange={e => setContent(e.target.value)}
                                placeholder={isJournal ? 'What happened today, and how did it feel?' : "What's on your mind?"}
                                className={addItemModal.textarea}
                            />
                        </div>

                        <div>
                            <label className={addItemModal.label}>Tags (comma separated)</label>
                            <input 
                                type="text"
                                value={tags}
                                onChange={e => setTags(e.target.value)}
                                placeholder="ideas, work, personal"
                                className={addItemModal.input}
                            />
                        </div>
                    </div>

                    <div className={addItemModal.footer}>
                        <button 
                            onClick={handleSave}
                            disabled={saving || !title.trim() && !content.trim()}
                            className={addItemModal.primaryButton}
                        >
                            <Check className="w-5 h-5" />
                            {isJournal ? 'Append to Today Journal' : 'Save Note'}
                        </button>
                    </div>
        </PresencePanel>
    );
};

export default AddNoteModal;
