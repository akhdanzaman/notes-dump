import React, { useState } from 'react';
import { BrainDumpItem } from '../types';
import { X, Save } from 'lucide-react';

interface EditModalProps {
  item: BrainDumpItem;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, newContent: string, newTags: string[]) => void;
}

const EditModal: React.FC<EditModalProps> = ({ item, isOpen, onClose, onSave }) => {
  const [content, setContent] = useState(item.content);
  const [tags, setTags] = useState(item.meta.tags?.join(', ') || '');

  if (!isOpen) return null;

  const handleSave = () => {
    const tagArray = tags.split(',').map(t => t.trim()).filter(t => t);
    onSave(item.id, content, tagArray);
    onClose();
  };

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
              className="w-full bg-background border border-border rounded-lg p-3 text-white focus:outline-none focus:border-acc-todo resize-none h-32"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
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