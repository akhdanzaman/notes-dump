import React, { useState } from 'react';
import { BrainDumpItem, Wallet } from '../types';
import PresencePanel from '../motion/PresencePanel';
import { addItemModal, responsiveModal } from './layout/contentSurface';
import { useEditorDraft } from '../hooks/useEditorDraft';
export default function ShoppingCompletionModal({ item, wallets, hideMoney, onClose, onSave }: { item: BrainDumpItem; wallets: Wallet[]; hideMoney: boolean; onClose: () => void; onSave: (value: { amount: number; paymentMethod: string; date: string }) => Promise<void> }) {
 const [amount, setAmount] = useState(String(item.meta.amount || ''));
 const [wallet, setWallet] = useState(item.meta.paymentMethod || '');
 const [date, setDate] = useState(() => { const now = new Date(); return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0,16); });
 const [reveal, setReveal] = useState(!hideMoney); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
 const draft = useEditorDraft(`purchase:${item.id}`, { amount, wallet, date }, v => { setAmount(v.amount); setWallet(v.wallet); setDate(v.date); });
 const valid = Number(amount) > 0 && Number.isFinite(Number(amount)) && Boolean(wallet) && !Number.isNaN(new Date(date).getTime());
 const save = async () => { if (!valid || saving) return; setSaving(true); setError(''); try { await onSave({ amount: Number(amount), paymentMethod: wallet, date: new Date(date).toISOString() }); draft.clear(); onClose(); } catch (e) { setError(e instanceof Error ? e.message : 'Pembelian belum tersimpan.'); } finally { setSaving(false); } };
 return <PresencePanel isOpen onClose={onClose} presentation="form" protectDraft hasDraft={draft.dirty.current} onDraftChange={draft.markDirty} onDiscardDraft={draft.clear} saving={saving} saveError={error} overlayClassName={responsiveModal.sheetOverlay} panelClassName={addItemModal.panel} ariaLabel="Catat pembelian">
 <div className={addItemModal.header}><h2 className={addItemModal.title}>Catat pembelian</h2><button data-editor-close onClick={onClose} aria-label="Tutup pembelian">✕</button></div>
 <div className={addItemModal.body}><p className="font-semibold">{item.content}</p><p className="text-sm text-muted">Pembelian ini menyelesaikan item belanja dan mencatat satu transaksi pengeluaran.</p>
 {reveal ? <label className="block text-sm">Nominal aktual<input type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} className={addItemModal.input} /></label> : <button className="editor-primary" onClick={() => setReveal(true)}>Tampilkan nominal sementara</button>}
 <label className="block text-sm">Wallet<select value={wallet} onChange={e => setWallet(e.target.value)} className={addItemModal.select}><option value="">Pilih wallet</option>{wallets.map(w => <option key={w.id} value={w.name}>{w.name}</option>)}</select></label>
 <label className="block text-sm">Tanggal pembelian<input type="datetime-local" value={date} onChange={e => setDate(e.target.value)} className={addItemModal.input} /></label>
 {!valid && <p className="text-sm text-muted">Isi nominal positif, wallet, dan tanggal yang valid.</p>}</div>
 <div className={addItemModal.footer}><button className={addItemModal.primaryButton} disabled={!valid || saving} onClick={() => void save()}>Simpan pembelian</button></div>
 </PresencePanel>;
}
