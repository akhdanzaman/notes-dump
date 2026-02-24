import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BrainDumpItem, FinanceType, ShoppingCategory } from '../../types';
import { getShoppingItems } from '../../utils/selectors';
import ShoppingItem from '../ShoppingItem';

interface ShoppingViewProps {
    items: BrainDumpItem[];
    handleToggleStatus: (id: string) => void;
    handleDelete: (id: string) => void;
    handleUpdateItem: (
        id: string, 
        newContent: string, 
        newTags: string[], 
        newAmount?: number, 
        newDate?: string, 
        newPaymentMethod?: string, 
        newBudgetCategory?: string, 
        newDuration?: number, 
        newSkillId?: string, 
        newToWallet?: string, 
        newFinanceType?: FinanceType, 
        newProgress?: number, 
        newProgressNotes?: string,
        newShoppingCategory?: ShoppingCategory,
        newRecurrenceDays?: number,
        newQuantity?: string
    ) => void;
}

const ShoppingView: React.FC<ShoppingViewProps> = ({
    items, handleToggleStatus, handleDelete, handleUpdateItem
}) => {
    
    const { urgent, routine, normal } = getShoppingItems(items);
    const isEmpty = urgent.length === 0 && routine.length === 0 && normal.length === 0;

    const renderGroup = (title: string, list: BrainDumpItem[], colorClass: string) => {
        if (list.length === 0) return null;
        return (
            <div className="mb-6">
                    <h3 className={`text-sm font-bold ${colorClass} uppercase tracking-wider mb-2 pl-1`}>{title}</h3>
                    <div className="space-y-2">
                        {list.map(item => (
                        <ShoppingItem 
                            key={item.id} 
                            item={item} 
                            onToggleStatus={handleToggleStatus} 
                            onDelete={handleDelete} 
                            handleUpdateItem={handleUpdateItem} 
                        />
                        ))}
                    </div>
            </div>
        );
    };

    return (
    <div className="pb-20 min-h-[50vh]">
        {/* Top Container */}
        <motion.div 
            layoutId="top-container"
            className="bg-white dark:bg-zinc-100 text-black rounded-b-[32px] p-6 pt-12 shadow-sm mb-4"
            transition={{ type: "tween", duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
        >
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: "linear" }}
            >
                <h1 className="text-3xl font-bold tracking-tight mb-6">Life & Shopping</h1>
                <div className="flex gap-4">
                    <div className="flex-1">
                        <p className="text-sm font-bold opacity-60 uppercase tracking-wider mb-1 text-red-600 dark:text-red-500">Urgent</p>
                        <p className="text-3xl font-bold">{urgent.length}</p>
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-bold opacity-60 uppercase tracking-wider mb-1">Routine</p>
                        <p className="text-3xl font-bold">{routine.length}</p>
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-bold opacity-60 uppercase tracking-wider mb-1">Normal</p>
                        <p className="text-3xl font-bold">{normal.length}</p>
                    </div>
                </div>
            </motion.div>
        </motion.div>

        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.4, delay: 0.1 } }}
            exit={{ opacity: 0, y: 10, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } }}
            className="px-4"
        >
            {isEmpty ? (
                <div className="text-center text-muted py-10">No life admin tasks.</div>
            ) : (
                <>
                    {renderGroup("Urgent", urgent, "text-red-500")}
                    {renderGroup("Routine & Maintenance", routine, "text-acc-event")}
                    {renderGroup("To Do / To Buy", normal, "text-acc-shopping")}
                </>
            )}
        </motion.div>
    </div>
    );
};

export default ShoppingView;