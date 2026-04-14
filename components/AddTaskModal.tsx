import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Calendar, AlertCircle } from 'lucide-react';
import { Priority } from '../types';

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
            <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
                <motion.div 
                    initial={{ opacity: 0, y: 100 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 100 }}
                    className="bg-surface rounded-t-[32px] sm:rounded-[32px] w-full max-w-md shadow-2xl overflow-hidden flex flex-col"
                >
                    <div className="p-6 border-b border-border flex justify-between items-center shrink-0">
                        <h3 className="text-xl font-bold text-primary flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-indigo-500" />
                            Add New Task
                        </h3>
                        <button onClick={onClose} className="p-2 bg-muted/10 hover:bg-muted/20 rounded-full text-muted transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="p-6 space-y-6">
                        <div>
                            <label className="block text-sm font-bold text-muted mb-2 uppercase tracking-wider">Task Description</label>
                            <input 
                                type="text"
                                autoFocus
                                value={content}
                                onChange={e => setContent(e.target.value)}
                                placeholder="What needs to be done?"
                                className="w-full bg-background border border-border rounded-2xl p-4 text-primary focus:outline-none focus:border-indigo-500 font-medium"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-muted mb-2 uppercase tracking-wider">Due Date</label>
                            <input 
                                type="date"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                className="w-full bg-background border border-border rounded-2xl p-4 text-primary focus:outline-none focus:border-indigo-500 font-medium"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-muted mb-2 uppercase tracking-wider">Start Time</label>
                                <input 
                                    type="datetime-local"
                                    value={start}
                                    onChange={e => setStart(e.target.value)}
                                    className="w-full bg-background border border-border rounded-2xl p-4 text-primary focus:outline-none focus:border-indigo-500 font-medium"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-muted mb-2 uppercase tracking-wider">End Time</label>
                                <input 
                                    type="datetime-local"
                                    value={end}
                                    onChange={e => setEnd(e.target.value)}
                                    className="w-full bg-background border border-border rounded-2xl p-4 text-primary focus:outline-none focus:border-indigo-500 font-medium"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-muted mb-2 uppercase tracking-wider">Priority</label>
                            <div className="grid grid-cols-3 gap-2">
                                {(['low', 'normal', 'high'] as Priority[]).map(p => (
                                    <button
                                        key={p}
                                        onClick={() => setPriority(p)}
                                        className={`py-3 rounded-xl font-bold text-sm capitalize transition-all ${
                                            priority === p 
                                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
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
                                className="w-4 h-4 rounded border-border text-indigo-600 focus:ring-indigo-500"
                            />
                            <label htmlFor="hideFromCalendarTask" className="text-sm font-medium text-primary">
                                Hide from Calendar
                            </label>
                        </div>
                    </div>

                    <div className="p-6 border-t border-border shrink-0">
                        <button 
                            onClick={handleSave}
                            disabled={!content.trim()}
                            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
