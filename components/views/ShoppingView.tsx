
import React from 'react';
import { BrainDumpItem } from '../../types';
import { getShoppingItems } from '../../utils/selectors';
import ShoppingItem from '../ShoppingItem';

interface ShoppingViewProps {
    items: BrainDumpItem[];
    handleToggleStatus: (id: string) => void;
    handleDelete: (id: string) => void;
    setEditingItem: (item: BrainDumpItem) => void;
}

const ShoppingView: React.FC<ShoppingViewProps> = ({
    items, handleToggleStatus, handleDelete, setEditingItem
}) => {
    const { urgent, routine, normal } = getShoppingItems(items);
    if (urgent.length === 0 && routine.length === 0 && normal.length === 0) return <div className="text-center text-muted py-10">No life admin tasks.</div>;

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
                            onEdit={setEditingItem} 
                        />
                        ))}
                    </div>
            </div>
        );
    };

    return (
    <div>
        {renderGroup("Urgent", urgent, "text-red-500")}
        {renderGroup("Routine & Maintenance", routine, "text-acc-event")}
        {renderGroup("To Do / To Buy", normal, "text-acc-shopping")}
    </div>
    );
};

export default ShoppingView;
