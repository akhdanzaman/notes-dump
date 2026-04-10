import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, StickyNote } from 'lucide-react';

interface AddNoteModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (content: string, tags: string[]) => void;
}

const AddNoteModal: React.FC<AddNoteModalProps> = ({ isOpen, onClose, onSave }) => {
    const [content, setContent] = useState('');
    const [tags, setTags] = useState('');

    const handleSave = () => {
        if (!content.trim()) return;
        const tagList = tags.split(',').map(t => t.trim()).filter(t => t);
        onSave(content, tagList);
        setContent('');
        setTags('');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
                <motion.div 
                    initial={{ opacity: 0, y: 100 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 100 }}
                    className="bg-surface rounded-t-[32px] sm:rounded-[32px] w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                >
                    <div className="p-6 border-b border-border flex justify-between items-center shrink-0">
                        <h3 className="text-xl font-bold text-primary flex items-center gap-2">
                            <StickyNote className="w-5 h-5 text-indigo-500" />
                            Add Note
                        </h3>
                        <button onClick={onClose} className="p-2 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 rounded-full text-muted transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="p-6 space-y-4 overflow-y-auto">
                        <div>
                            <label className="block text-xs font-bold text-muted mb-1 uppercase tracking-wider">Content</label>
                            <textarea 
                                autoFocus
                                value={content}
                                onChange={e => setContent(e.target.value)}
                                placeholder="What's on your mind?"
                                className="w-full bg-background border border-border rounded-2xl p-4 text-primary focus:outline-none focus:border-indigo-500 font-medium min-h-[150px] resize-none"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-muted mb-1 uppercase tracking-wider">Tags (comma separated)</label>
                            <input 
                                type="text"
                                value={tags}
                                onChange={e => setTags(e.target.value)}
                                placeholder="ideas, work, personal"
                                className="w-full bg-background border border-border rounded-2xl p-4 text-primary focus:outline-none focus:border-indigo-500 font-medium"
                            />
                        </div>
                    </div>

                    <div className="p-6 border-t border-border shrink-0 bg-surface">
                        <button 
                            onClick={handleSave}
                            disabled={!content.trim()}
                            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <Check className="w-5 h-5" />
                            Save Note
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default AddNoteModal;
