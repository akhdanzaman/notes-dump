
import React, { useState, useRef } from 'react';
import { BrainDumpItem, ItemType, BudgetRule, Skill, Wallet, FinanceType } from '../types';
import { X, Save, DollarSign, Calendar, Wallet as WalletIcon, Hourglass, ArrowRight, Bold, Italic, List, Type } from 'lucide-react';

interface EditModalProps {
  item: BrainDumpItem;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, newContent: string, newTags: string[], amount?: number, date?: string, paymentMethod?: string, budgetCategory?: string, durationMinutes?: number, skillId?: string, toWallet?: string, financeType?: FinanceType) => void;
  existingPaymentMethods?: string[];
  budgetRules?: BudgetRule[];
  skills?: Skill[];
  wallets?: Wallet[];
}

const EditModal: React.FC<EditModalProps> = ({ item, isOpen, onClose, onSave, existingPaymentMethods = [], budgetRules = [], skills = [], wallets = [] }) => {
  const [content, setContent] = useState(item.content);
  const [tags, setTags] = useState(item.meta.tags?.join(', ') || '');
  const [amount, setAmount] = useState<string>(item.meta.amount ? item.meta.amount.toString() : '');
  
  const [financeType, setFinanceType] = useState<FinanceType>(item.meta.financeType || 'expense');
  const [paymentMethod, setPaymentMethod] = useState(item.meta.paymentMethod || '');
  const [toWallet, setToWallet] = useState(item.meta.toWallet || '');
  const [budgetCategory, setBudgetCategory] = useState<string>(item.meta.budgetCategory || '');
  
  // Skill specific
  const [duration, setDuration] = useState<string>(item.meta.durationMinutes ? item.meta.durationMinutes.toString() : '');
  const [skillId, setSkillId] = useState<string>(item.meta.skillId || '');

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const getInitialDate = (item: BrainDumpItem) => {
      // Priority: meta.date > completed_at > created_at
      const isoDate = (item.meta.date && item.meta.date !== 'null') ? item.meta.date : (item.completed_at || item.created_at);
      if (!isoDate) return '';
      const date = new Date(isoDate);
      if (isNaN(date.getTime())) return '';
      const offset = date.getTimezoneOffset() * 60000;
      const localDate = new Date(date.getTime() - offset);
      return localDate.toISOString().slice(0, 16);
  };

  const [date, setDate] = useState<string>(getInitialDate(item));

  if (!isOpen) return null;

  const handleSave = () => {
    const tagArray = tags.split(',').map(t => t.trim()).filter(t => t);
    const numAmount = amount ? parseFloat(amount) : undefined;
    const numDuration = duration ? parseFloat(duration) : undefined;

    let finalDate: string | undefined = undefined;
    if (date) {
        finalDate = new Date(date).toISOString();
    }

    const finalBudgetCategory = budgetCategory === '' ? undefined : budgetCategory;
    const finalSkillId = skillId === '' ? undefined : skillId;
    const finalToWallet = financeType === 'transfer' && toWallet ? toWallet : undefined;

    onSave(item.id, content, tagArray, numAmount, finalDate, paymentMethod, finalBudgetCategory, numDuration, finalSkillId, finalToWallet, financeType);
    onClose();
  };

  // Text Formatting Helpers
  const insertFormat = (startChar: string, endChar: string = '') => {
      if (!textareaRef.current) return;
      
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      const text = content;
      
      const before = text.substring(0, start);
      const selected = text.substring(start, end);
      const after = text.substring(end);
      
      const newText = before + startChar + selected + endChar + after;
      
      setContent(newText);
      
      // Need to defer focus to allow render
      setTimeout(() => {
          if (textareaRef.current) {
              textareaRef.current.focus();
              textareaRef.current.selectionStart = start + startChar.length;
              textareaRef.current.selectionEnd = end + startChar.length;
          }
      }, 0);
  };

  const handleBold = () => insertFormat('**', '**');
  const handleItalic = () => insertFormat('_', '_');
  const handleList = () => {
      if (!textareaRef.current) return;
      // If at start of line, just add "- ". If in middle, add "\n- "
      const start = textareaRef.current.selectionStart;
      const text = content;
      const isStartOfLine = start === 0 || text[start - 1] === '\n';
      insertFormat(isStartOfLine ? '- ' : '\n- ');
  };

  const isNote = item.type === ItemType.NOTE || item.type === ItemType.JOURNAL;
  const showAmountField = item.type === ItemType.FINANCE || item.type === ItemType.SHOPPING || item.type === ItemType.TODO;
  const showDateField = item.type === ItemType.TODO || item.type === ItemType.EVENT || item.type === ItemType.SHOPPING || item.type === ItemType.FINANCE || item.type === ItemType.SKILL_LOG || item.type === ItemType.JOURNAL;
  const showFinanceExtras = item.type === ItemType.FINANCE || (item.type === ItemType.SHOPPING && showAmountField);
  const showSkillExtras = item.type === ItemType.SKILL_LOG;

  const displayRules = budgetRules.length > 0 ? budgetRules : [
      { id: 'needs', name: 'Needs', percentage: 50, color: 'bg-blue-500' },
      { id: 'wants', name: 'Wants', percentage: 30, color: 'bg-pink-500' },
      { id: 'savings', name: 'Savings', percentage: 20, color: 'bg-emerald-500' }
  ];

  const walletOptions = (
      <>
        <option value="">None / Cash</option>
        {wallets.map(w => (
            <option key={w.id} value={w.name}>{w.name}</option>
        ))}
        {existingPaymentMethods.filter(pm => pm && !wallets.some(w => w.name === pm)).map((pm, i) => (
            <option key={`legacy-${i}`} value={pm}>{pm}</option>
        ))}
      </>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className={`bg-surface border border-border rounded-xl w-full shadow-2xl p-6 max-h-[90vh] overflow-y-auto no-scrollbar transition-all ${isNote ? 'max-w-2xl' : 'max-w-md'}`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-primary">Edit {item.type}</h3>
          <button onClick={onClose} className="text-muted hover:text-primary">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Finance Type Selector */}
          {item.type === ItemType.FINANCE && (
              <div className="flex bg-background border border-border rounded-lg p-1">
                  {(['expense', 'income', 'transfer', 'lending', 'reimbursement'] as FinanceType[]).map(ft => (
                      <button
                        key={ft}
                        onClick={() => setFinanceType(ft)}
                        className={`flex-1 py-1.5 text-[10px] font-medium rounded capitalize ${financeType === ft ? 'bg-indigo-600 text-white' : 'text-muted hover:text-primary'}`}
                      >
                          {ft}
                      </button>
                  ))}
              </div>
          )}

          {/* Content Area with Toolbar for Notes */}
          <div>
            <div className="flex justify-between items-end mb-1">
                <label className="block text-xs font-medium text-muted">Content</label>
                {isNote && (
                    <div className="flex gap-1 bg-background border border-border rounded-md p-1">
                        <button onClick={handleBold} className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded text-muted hover:text-primary" title="Bold"><Bold className="w-3 h-3" /></button>
                        <button onClick={handleItalic} className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded text-muted hover:text-primary" title="Italic"><Italic className="w-3 h-3" /></button>
                        <button onClick={handleList} className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded text-muted hover:text-primary" title="List"><List className="w-3 h-3" /></button>
                    </div>
                )}
            </div>
            <textarea
              ref={textareaRef}
              className={`w-full bg-background border border-border rounded-lg p-3 text-primary focus:outline-none focus:border-indigo-500 placeholder-muted/50 ${isNote ? 'h-48' : 'h-24'}`}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
               {/* Amount Field */}
               {showAmountField && (
                   <div className={item.type === ItemType.FINANCE && financeType === 'transfer' ? "col-span-2" : ""}>
                        <label className="block text-xs font-medium text-muted mb-1 flex items-center gap-1">
                            <DollarSign className="w-3 h-3" /> Amount
                        </label>
                        <input
                            type="number"
                            className="w-full bg-background border border-border rounded-lg p-3 text-primary focus:outline-none focus:border-indigo-500"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0"
                        />
                   </div>
               )}

               {/* Date Field */}
               {showDateField && (
                   <div className={(!showAmountField && !showSkillExtras) ? "col-span-2" : ""}>
                        <label className="block text-xs font-medium text-muted mb-1 flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> Date
                        </label>
                        <input
                            type="datetime-local"
                            className="w-full bg-background border border-border rounded-lg p-3 text-primary focus:outline-none focus:border-indigo-500 [color-scheme:dark] dark:[color-scheme:dark] [color-scheme:light]"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                        />
                   </div>
               )}
          </div>
          
          {/* Skill Extras */}
          {showSkillExtras && (
              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1 flex items-center gap-1">
                        <Hourglass className="w-3 h-3" /> Duration (min)
                    </label>
                    <input
                        type="number"
                        className="w-full bg-background border border-border rounded-lg p-3 text-primary focus:outline-none focus:border-indigo-500"
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                        placeholder="Minutes"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1 flex items-center gap-1">
                        <Type className="w-3 h-3" /> Skill
                    </label>
                    <select
                        className="w-full bg-background border border-border rounded-lg p-3 text-primary focus:outline-none focus:border-indigo-500"
                        value={skillId}
                        onChange={(e) => setSkillId(e.target.value)}
                    >
                        <option value="">Uncategorized</option>
                        {skills.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                  </div>
              </div>
          )}

          {/* Finance Extras */}
          {showFinanceExtras && (
              <div className="space-y-4 pt-2 border-t border-border/50">
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                          <label className="block text-xs font-medium text-muted mb-1 flex items-center gap-1">
                             <WalletIcon className="w-3 h-3" /> {financeType === 'transfer' ? 'From Wallet' : 'Payment Method'}
                          </label>
                          <select
                            className="w-full bg-background border border-border rounded-lg p-3 text-primary focus:outline-none focus:border-indigo-500"
                            value={paymentMethod}
                            onChange={(e) => setPaymentMethod(e.target.value)}
                          >
                             {walletOptions}
                          </select>
                      </div>

                      {financeType === 'transfer' ? (
                          <div>
                            <label className="block text-xs font-medium text-muted mb-1 flex items-center gap-1">
                                <ArrowRight className="w-3 h-3" /> To Wallet
                            </label>
                            <select
                                className="w-full bg-background border border-border rounded-lg p-3 text-primary focus:outline-none focus:border-indigo-500"
                                value={toWallet}
                                onChange={(e) => setToWallet(e.target.value)}
                            >
                                {walletOptions}
                            </select>
                          </div>
                      ) : (
                          <div>
                            <label className="block text-xs font-medium text-muted mb-1">Budget Category</label>
                            <select
                                className="w-full bg-background border border-border rounded-lg p-3 text-primary focus:outline-none focus:border-indigo-500"
                                value={budgetCategory}
                                onChange={(e) => setBudgetCategory(e.target.value)}
                            >
                                <option value="">Uncategorized</option>
                                {displayRules.map(rule => (
                                    <option key={rule.id} value={rule.id}>{rule.name}</option>
                                ))}
                            </select>
                          </div>
                      )}
                  </div>
              </div>
          )}
          
          {/* Tags */}
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Tags (comma separated)</label>
            <input
              type="text"
              className="w-full bg-background border border-border rounded-lg p-3 text-primary focus:outline-none focus:border-indigo-500 placeholder-muted/50"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="work, personal, urgent"
            />
          </div>

        </div>

        <div className="flex justify-end gap-2 mt-6">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted hover:text-primary">Cancel</button>
            <button 
                onClick={handleSave}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-500 transition-colors flex items-center gap-2"
            >
                <Save className="w-4 h-4" /> Save Changes
            </button>
        </div>
      </div>
    </div>
  );
};

export default EditModal;
