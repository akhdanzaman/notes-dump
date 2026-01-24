import React, { useState } from 'react';
import { BrainDumpItem, ItemType } from '../types';
import { X, Save, DollarSign, Calendar } from 'lucide-react';

interface EditModalProps {
  item: BrainDumpItem;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, newContent: string, newTags: string[], amount?: number, date?: string) => void;
}

const EditModal: React.FC<EditModalProps> = ({ item, isOpen, onClose, onSave }) => {
  const [content, setContent] = useState(item.content);
  const [tags, setTags] = useState(item.meta.tags?.join(', ') || '');
  const [amount, setAmount] = useState<string>(item.meta.amount ? item.meta.amount.toString() : '');
  
  // Helper to convert UTC ISO string to Local datetime-local format (YYYY-MM-DDTHH:mm)
  const getInitialDate = (isoDate?: string) => {
      if (!isoDate || isoDate === 'null') return '';
      const date = new Date(isoDate);
      if (isNaN(date.getTime())) return '';
      const offset = date.getTimezoneOffset() * 60000;
      const localDate = new Date(date.getTime() - offset);
      return localDate.toISOString().slice(0, 16);
  };

  const [date, setDate] = useState<string>(getInitialDate(item.meta.date));

  if (!isOpen) return null;

  const handleSave = () => {
    const tagArray = tags.split(',').map(t => t.trim()).filter(t => t);
    const numAmount = amount ? parseFloat(amount) : undefined;
    
    // Convert local datetime back to ISO UTC
    let finalDate: string | undefined = undefined;
    if (date) {
        finalDate = new Date(date).toISOString();
    }

    onSave(item.id, content, tagArray, numAmount, finalDate);
    onClose();
  };

  const showAmountField = item.type === ItemType.FINANCE || item.type === ItemType.SHOPPING || item.type === ItemType.TODO;
  const showDateField = item.type === ItemType.TODO || item.type === ItemType.EVENT || item.type === ItemType.SHOPPING;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-xl w-full max-w-md shadow-2xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-white">Edit Item</h3>
          <button onClick={onClose} className="text-muted hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Content</label>
            <textarea
              className="w-full bg-background border border-border rounded-lg p-3 text-white focus:outline-none focus:border-acc-todo resize-none h-24"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            {showDateField && (
              <div className={!showAmountField ? "col-span-2" : ""}>
                 <label className="block text-xs font-medium text-muted mb-1">Due Date</label>
                 <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                    <input
                      type="datetime-local"
                      className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-3 text-white focus:outline-none focus:border-acc-todo [color-scheme:dark]"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                 </div>
              </div>
            )}

            {showAmountField && (
              <div className={!showDateField ? "col-span-2" : ""}>
                <label className="block text-xs font-medium text-muted mb-1">Cost / Price (IDR)</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                  <input
                    type="number"
                    className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-3 text-white focus:outline-none focus:border-acc-todo"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1">Tags (comma separated)</label>
            <input
              type="text"
              className="w-full bg-background border border-border rounded-lg p-3 text-white focus:outline-none focus:border-acc-todo"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="work, idea, priority"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button 
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-muted hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="px-4 py-2 bg-primary text-background rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-white transition-colors"
          >
            <Save className="w-4 h-4" /> Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditModal;