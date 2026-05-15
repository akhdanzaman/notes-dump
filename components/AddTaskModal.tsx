import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Calendar } from 'lucide-react';
import { Priority } from '../types';
import { addItemModal, responsiveModal } from './layout/contentSurface';

interface AddTaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (content: string, date: string, priority: Priority, start?: string, end?: string, hideFromCalendar?: boolean) => void;
    initialDate?: string;
}

const AddTaskModal: React.FC<AddTaskModalProps> = ({ isOpen, onClose, onSave, initialDate }) => {
    const [content, setContent] = useState('');
    const [date, setDate] = useState(initialDate || new Date().toISOString().split('T')[0]);
    const [start, setStart] = useState('');
    const [end, setEnd] = useState('');
    const [priority, setPriority] = useState<Priority>('normal');
    const [hideFromCalendar, setHideFromCalendar] = useState(false);

    const handleSave = () => {
        if (!content.trim()) return;

        let startIso, endIso;
        if (start) startIso = new Date(start).toISOString();
        if (end) endIso = new Date(end).toISOString();

        onSave(content, new Date(date).toISOString(), priority, startIso, endIso, hideFromCalendar);
        setContent('');
        setStart('');
        setEnd('');
        setPriority('normal');
        setHideFromCalendar(false);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className={responsiveModal.sheetOverlay} data-tablet-modal-overlay="add-task">
                <motion.div
                    initial={{ opacity: 0, y: 100 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 100 }}
                    className={addItemModal.panel}
                    data-tablet-modal-panel="add-task"
                    data-ndz-tablet-baseline="modal"
                >
                    <div className={addItemModal.header}>
                        <h3 className={addItemModal.title}>
                            <Calendar className={addItemModal.icon} />
                            Add New Task
                        </h3>
                        <button onClick={onClose} className={addItemModal.closeButton}>
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className={addItemModal.body}>
                        <div>
                            <label className={addItemModal.label}>Task Description</label>
                            <input
                                type="text"
                                autoFocus
                                value={content}
                                onChange={e => setContent(e.target.value)}
                                placeholder="What needs to be done?"
                                className={addItemModal.input}
                            />
                        </div>

                        <div>
                            <label className={addItemModal.label}>Due Date</label>
                            <input
                                type="date"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                className={addItemModal.input}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={addItemModal.label}>Start Time</label>
                                <input
                                    type="datetime-local"
                                    value={start}
                                    onChange={e => setStart(e.target.value)}
                                    className={addItemModal.input}
                                />
                            </div>
                            <div>
                                <label className={addItemModal.label}>End Time</label>
                                <input
                                    type="datetime-local"
                                    value={end}
                                    onChange={e => setEnd(e.target.value)}
                                    className={addItemModal.input}
                                />
                            </div>
                        </div>

                        <div>
                            <label className={addItemModal.label}>Priority</label>
                            <div className="grid grid-cols-3 gap-2">
                                {(['low', 'normal', 'high'] as Priority[]).map(p => (
                                    <button
                                        key={p}
                                        onClick={() => setPriority(p)}
                                        className={`py-3 rounded-xl font-bold text-sm capitalize transition-all ${
                                            priority === p
                                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                                                : 'bg-background border border-border text-muted hover:border-indigo-500/50'
                                        }`}
                                    >
                                        {p}
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
                                Hide from Calendar
                            </label>
                        </div>
                    </div>

                    <div className={addItemModal.footer}>
                        <button
                            onClick={handleSave}
                            disabled={!content.trim()}
                            className={addItemModal.primaryButton}
                        >
                            <Check className="w-5 h-5" />
                            Add Task
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default AddTaskModal;
