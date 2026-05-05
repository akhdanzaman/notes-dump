import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bot, User, Loader2, RotateCcw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { BrainDumpItem, BudgetConfig, Skill, Wallet, ChatMessage } from '../types';
import { generateChatResponse } from '../services/chatService';

interface FloatingChatBoxProps {
    isOpen: boolean;
    onClose: () => void;
    items: BrainDumpItem[];
    budgetConfig: BudgetConfig;
    wallets: Wallet[];
    skills: Skill[];
    monthlyThemes: Record<string, string>;
    newMessage: { text: string; id: string } | null;
    chatHistory: ChatMessage[];
    onUpdateHistory: (newHistory: ChatMessage[]) => void;
    onResetChat: () => void;
    chatModel?: string;
}

const FloatingChatBox: React.FC<FloatingChatBoxProps> = ({ isOpen, onClose, items, budgetConfig, wallets, skills, monthlyThemes, newMessage, chatHistory, onUpdateHistory, onResetChat, chatModel }) => {
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const [lastProcessedId, setLastProcessedId] = useState<string | null>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (isOpen) {
            // Use setTimeout to ensure the DOM has updated and the modal is visible before scrolling
            setTimeout(scrollToBottom, 100);
        }
    }, [chatHistory, isLoading, isOpen]);

    useEffect(() => {
        if (isOpen && newMessage && newMessage.id !== lastProcessedId) {
            setLastProcessedId(newMessage.id);
            handleSend(newMessage.text);
        }
    }, [isOpen, newMessage, lastProcessedId]);

    const handleSend = async (text: string) => {
        if (!text.trim()) return;

        const userMsg: ChatMessage = { role: 'user', text };
        const updatedHistory = [...chatHistory, userMsg];
        onUpdateHistory(updatedHistory);
        setIsLoading(true);

        try {
            const responseText = await generateChatResponse(text, updatedHistory, items, budgetConfig, wallets, skills, monthlyThemes, chatModel);
            const modelMsg: ChatMessage = { role: 'model', text: responseText };
            onUpdateHistory([...updatedHistory, modelMsg]);
        } catch (error) {
            console.error("Failed to get chat response:", error);
            onUpdateHistory([...updatedHistory, { role: 'model', text: "Sorry, I encountered an error." }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="absolute bottom-full left-0 right-0 mb-4 mx-4 md:mx-auto max-w-2xl lg:max-w-3xl bg-surface/90 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col z-50 pointer-events-auto h-[400px] max-h-[60vh]"
                >
                    {/* Controls */}
                    <div className="absolute top-4 right-4 z-10">
                        <button 
                            onClick={onClose} 
                            className="w-8 h-8 flex items-center justify-center bg-black/20 hover:bg-black/40 backdrop-blur-md rounded-full text-white/70 hover:text-white transition-all"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="absolute top-4 left-4 z-10">
                        <button 
                            onClick={onResetChat} 
                            className="w-8 h-8 flex items-center justify-center bg-black/20 hover:bg-black/40 backdrop-blur-md rounded-full text-white/70 hover:text-white transition-all"
                            title="Reset Chat"
                        >
                            <RotateCcw className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-6 pt-16 space-y-6 no-scrollbar">
                        {(!chatHistory || chatHistory.length === 0) && !isLoading && (
                            <div className="h-full flex items-center justify-center opacity-30">
                                <p className="text-sm font-medium tracking-wide">ask me anything</p>
                            </div>
                        )}
                        {(chatHistory || []).filter(Boolean).map((msg, idx) => (
                            <div key={idx} className={`flex gap-3 ${msg?.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg?.role === 'user' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'}`}>
                                    {msg?.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                                </div>
                                <div className={`px-4 py-3 rounded-2xl max-w-[80%] text-sm leading-relaxed ${msg?.role === 'user' ? 'bg-emerald-500/10 text-emerald-100 rounded-tr-sm' : 'bg-white/5 text-primary rounded-tl-sm'}`}>
                                    {msg?.role === 'user' ? (
                                        msg?.text
                                    ) : (
                                        <div className="prose prose-invert prose-sm max-w-none">
                                            <ReactMarkdown>{msg?.text || ''}</ReactMarkdown>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex gap-3">
                                <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
                                    <Bot className="w-4 h-4" />
                                </div>
                                <div className="px-4 py-3 rounded-2xl bg-white/5 text-primary rounded-tl-sm flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                                    <span className="text-sm text-muted">Thinking...</span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default FloatingChatBox;
