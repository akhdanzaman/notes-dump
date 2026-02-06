import React, { useState, useMemo } from 'react';
import { BrainDumpItem, ItemType, BudgetRule, Skill, Wallet, FinanceType } from '../types';
import { X, Save, DollarSign, Calendar, Wallet as WalletIcon, PieChart, Hourglass, BookOpen, ArrowRight } from 'lucide-react';

interface EditModalProps {
  item: BrainDumpItem;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, newContent: string, newTags: string[], amount?: number, date?: string, paymentMethod?: string, budgetCategory?: string, durationMinutes?: number, skillId?: string, toWallet?: string, financeType?: FinanceType) => void;
  existingPaymentMethods?: string[]; // To populate datalist for backward compatibility
  budgetRules?: BudgetRule[]; // To populate budget category selector
  skills?: Skill[]; // To populate skill selector
  wallets?: Wallet[]; // To populate payment method selector
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
    const numDuration = duration ? parseFloat(duration) : undefined;

    // Convert local datetime back to ISO UTC
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

  const showAmountField = item.type === ItemType.FINANCE || item.type === ItemType.SHOPPING || item.type === ItemType.TODO;
  const showDateField = item.type === ItemType.TODO || item.type === ItemType.EVENT || item.type === ItemType.SHOPPING;
  const showFinanceExtras = item.type === ItemType.FINANCE || (item.type === ItemType.SHOPPING && showAmountField);
  const showSkillExtras = item.type === ItemType.SKILL_LOG;

  // If no custom rules, fallback to default 50-30-20 for display safety
  const displayRules = budgetRules.length > 0 ? budgetRules : [
      { id: 'needs', name: 'Needs', percentage: 50, color: 'bg-blue-500' },
      { id: 'wants', name: 'Wants', percentage: 30, color: 'bg-pink-500' },
      { id: 'savings', name: 'Savings', percentage: 20, color: 'bg-emerald-500' }
  ];

  const walletOptions = (
      <>
        {/* Prioritize Configured Wallets */}
        {wallets.map(w => (
            <option key={w.id} value={w.name} />
        ))}
        {/* Fallback to legacy payment methods */}
        {existingPaymentMethods.filter(pm => !wallets.some(w => w.name === pm)).map((pm, i) => (
            <option key={`legacy-${i}`} value={pm} />
        ))}
      </>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-xl w-full max-w-md shadow-2xl p-6 max-h-[90vh] overflow-y-auto no-scrollbar">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-white">Edit Item</h3>
          <button onClick={onClose} className="text-muted hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Finance Type Selector (Only for Finance) */}
          {item.type === ItemType.FINANCE && (
              <div className="flex bg-background border border-border rounded-lg p-1">
                  {(['expense', 'income', 'transfer', 'lending', 'reimbursement'] as FinanceType[]).map(ft => (
                      <button
                        key={ft}
                        onClick={() => setFinanceType(ft)}
                        className={`flex-1 py-1.5 text-[10px] font-medium rounded capitalize ${financeType === ft ? 'bg-indigo-600 text-white' : 'text-muted hover:text-white'}`}
                      >
                          {ft}
                      </button>
                  ))}
              </div>
          )}

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
                <label className="block text-xs font-medium text-muted mb-1">Amount (IDR)</label>
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

          {showFinanceExtras && (
             <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border/50">
                 {/* Source Wallet / Payment Method */}
                 <div className={financeType === 'transfer' ? '' : 'col-span-2'}>
                    <label className="block text-xs font-medium text-muted mb-1">
                        {financeType === 'transfer' ? 'From (Source)' : 'Payment Method / Wallet'}
                    </label>
                    <div className="relative">
                        <WalletIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                        <input
                            type="text"
                            list="payment-methods"
                            className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-3 text-white focus:outline-none focus:border-acc-todo"
                            value={paymentMethod}
                            onChange={(e) => setPaymentMethod(e.target.value)}
                            placeholder="e.g. Cash"
                        />
                        <datalist id="payment-methods">{walletOptions}</datalist>
                    </div>
                 </div>

                 {/* Destination Wallet (Transfer Only) */}
                 {financeType === 'transfer' && (
                     <div>
                        <label className="block text-xs font-medium text-muted mb-1">To (Destination)</label>
                        <div className="relative">
                            <ArrowRight className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                            <input
                                type="text"
                                list="to-wallets"
                                className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-3 text-white focus:outline-none focus:border-acc-todo"
                                value={toWallet}
                                onChange={(e) => setToWallet(e.target.value)}
                                placeholder="e.g. Bank"
                            />
                            <datalist id="to-wallets">{walletOptions}</datalist>
                        </div>
                     </div>
                 )}

                 {/* Budget Category (Hidden for transfers) */}
                 {financeType !== 'transfer' && (
                     <div className="col-span-2">
                         <label className="block text-xs font-medium text-muted mb-2">Budget Category</label>
                         <div className="flex flex-wrap gap-2">
                            {displayRules.map((rule) => {
                                 const isSelected = budgetCategory ? (budgetCategory === rule.id || budgetCategory.toLowerCase() === rule.name.toLowerCase()) : false;
                                 return (
                                    <button
                                        key={rule.id}
                                        onClick={() => setBudgetCategory(isSelected ? '' : rule.id)}
                                        className={`py-1.5 px-3 rounded-lg text-xs font-medium capitalize border transition-all flex items-center gap-2 ${
                                            isSelected
                                            ? `border-white/50 text-white ${rule.color}`
                                            : 'bg-background border-border text-muted hover:bg-surface'
                                        }`}
                                    >
                                        <div className={`w-2 h-2 rounded-full ${rule.color} ${isSelected ? 'ring-2 ring-white' : ''}`}></div>
                                        {rule.name}
                                    </button>
                                 );
                            })}
                         </div>
                     </div>
                 )}
             </div>
          )}

          {showSkillExtras && (
              <div className="space-y-4 pt-2 border-t border-border/50">
                  <div>
                      <label className="block text-xs font-medium text-muted mb-1">Duration (Minutes)</label>
                      <div className="relative">
                        <Hourglass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                        <input
                            type="number"
                            className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-3 text-white focus:outline-none focus:border-indigo-500"
                            value={duration}
                            onChange={(e) => setDuration(e.target.value)}
                            placeholder="e.g. 45"
                        />
                      </div>
                  </div>
                  <div>
                      <label className="block text-xs font-medium text-muted mb-1">Assigned Skill</label>
                      <div className="grid grid-cols-2 gap-2">
                          {skills.map(skill => {
                              const isSelected = skillId === skill.id;
                              return (
                                <button
                                    key={skill.id}
                                    onClick={() => setSkillId(isSelected ? '' : skill.id)}
                                    className={`py-2 px-3 rounded-lg text-xs font-medium border transition-all text-left ${
                                        isSelected
                                        ? 'border-indigo-500 bg-indigo-500/10 text-white'
                                        : 'bg-background border-border text-muted hover:bg-surface'
                                    }`}
                                >
                                    {skill.name}
                                </button>
                              );
                          })}
                      </div>
                  </div>
              </div>
          )}

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