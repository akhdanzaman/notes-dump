import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, StickyNote } from 'lucide-react';
import { addItemModal, addItemModalMotion, responsiveModal } from './layout/contentSurface';

interface AddNoteModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (title: string, content: string, tags: string[]) => void;
    mode?: 'note' | 'journal';
}

const AddNoteModal: React.FC<AddNoteModalProps> = ({ isOpen, onClose, onSave, mode = 'note' }) => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [tags, setTags] = useState('');

    const isJournal = mode === 'journal';

    const handleSave = () => {
        if (!title.trim() && !content.trim()) return;
        const tagList = tags.split(',').map(t => t.trim()).filter(t => t);
        onSave(title.trim(), content, tagList);
        setTitle('');
        setContent('');
        setTags('');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className={responsiveModal.sheetOverlay} data-tablet-modal-overlay="add-note">
                <motion.div 
                    initial={addItemModalMotion.initial}
                    animate={addItemModalMotion.animate}
                    exit={addItemModalMotion.exit}
                    transition={addItemModalMotion.transition}
                    className={addItemModal.panel}
                    data-tablet-modal-panel="add-note"
                    data-ndz-tablet-baseline="modal"
                >
                    <div className={addItemModal.header}>
                        <h3 className={addItemModal.title}>
                            <StickyNote className={addItemModal.icon} />
                            {isJournal ? 'Add Journal Entry' : 'Add Note'}
                        </h3>
                        <button onClick={onClose} className={addItemModal.closeButton}>
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
                            disabled={!title.trim() && !content.trim()}
                            className={addItemModal.primaryButton}
                        >
                            <Check className="w-5 h-5" />
                            {isJournal ? 'Append to Today Journal' : 'Save Note'}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default AddNoteModal;
