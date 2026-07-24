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
                    className="pointer-events-auto absolute bottom-full left-0 right-0 z-50 mx-3 mb-3 flex h-[460px] max-h-[62vh] flex-col overflow-hidden rounded-[26px] border border-border/80 bg-surface/96 shadow-2xl backdrop-blur-2xl sm:mx-auto sm:max-w-3xl lg:max-w-4xl"
                >
                    <div className="flex shrink-0 items-center justify-between border-b border-border/75 px-4 py-3.5 sm:px-5">
                        <div className="flex min-w-0 items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
                                <Bot className="h-[18px] w-[18px]" />
                            </span>
                            <div className="min-w-0">
                                <div className="truncate text-sm font-bold text-primary">Asisten Arkaiv</div>
                                <div className="truncate text-[10px] font-medium text-muted">Jawaban berdasarkan data workspace Anda</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={onResetChat}
                                className="flex h-9 w-9 items-center justify-center rounded-xl text-muted transition-colors hover:bg-black/[0.04] hover:text-primary dark:hover:bg-white/[0.06]"
                                title="Reset percakapan"
                                aria-label="Reset percakapan"
                            >
                                <RotateCcw className="h-4 w-4" />
                            </button>
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex h-9 w-9 items-center justify-center rounded-xl text-muted transition-colors hover:bg-black/[0.04] hover:text-primary dark:hover:bg-white/[0.06]"
                                aria-label="Tutup percakapan"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-5 no-scrollbar">
                        {(!chatHistory || chatHistory.length === 0) && !isLoading && (
                            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500">
                                    <Bot className="h-5 w-5" />
                                </div>
                                <p className="text-sm font-semibold text-primary">Tanyakan apa pun tentang workspace</p>
                                <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted">Contoh: ringkas pengeluaran bulan ini atau bantu prioritaskan tugas hari ini.</p>
                            </div>
                        )}
                        {(chatHistory || []).filter(Boolean).map((msg, idx) => (
                            <div key={idx} className={`flex gap-3 ${msg?.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${msg?.role === 'user' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500' : 'border-indigo-500/20 bg-indigo-500/10 text-indigo-500'}`}>
                                    {msg?.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                                </div>
                                <div className={`max-w-[84%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${msg?.role === 'user' ? 'rounded-tr-md bg-indigo-600 text-white' : 'rounded-tl-md border border-border/70 bg-background/60 text-primary'}`}>
                                    {msg?.role === 'user' ? (
                                        msg?.text
                                    ) : (
                                        <div className="prose prose-sm max-w-none text-primary dark:prose-invert">
                                            <ReactMarkdown>{msg?.text || ''}</ReactMarkdown>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex gap-3">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-indigo-500/20 bg-indigo-500/10 text-indigo-500">
                                    <Bot className="w-4 h-4" />
                                </div>
                                <div className="flex items-center gap-2 rounded-2xl rounded-tl-md border border-border/70 bg-background/60 px-4 py-3 text-primary">
                                    <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                                    <span className="text-sm text-muted">Sedang berpikir...</span>
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
