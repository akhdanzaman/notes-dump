import React, { useEffect, useRef, useState } from 'react';
import { Eye, Image as ImageIcon, RefreshCw, Trash2, X } from 'lucide-react';
import { ReceiptCaptureMeta } from '../types';
import {
  createReceiptFingerprint,
  deleteReceiptAttachment,
  getReceiptAttachmentUrl,
  saveReceiptAttachment,
} from '../services/receiptAttachmentService';

interface Props {
  capture?: ReceiptCaptureMeta;
  onChange?: (capture: ReceiptCaptureMeta | null) => void | Promise<void>;
  compact?: boolean;
}

const ReceiptAttachmentPanel: React.FC<Props> = ({ capture, onChange, compact = false }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [showPreview, setShowPreview] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;
    if (capture?.attachmentId) {
      void getReceiptAttachmentUrl(capture.attachmentId).then((url) => {
        objectUrl = url;
        if (active) setPreviewUrl(url);
      });
    } else {
      setPreviewUrl(undefined);
    }
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [capture?.attachmentId]);

  if (!capture?.imageName) return null;

  const replaceAttachment = async (file?: File) => {
    if (!file || !file.type.startsWith('image/') || !onChange) return;
    setIsUpdating(true);
    try {
      const attachmentId = await saveReceiptAttachment(file);
      const fingerprint = await createReceiptFingerprint(file);
      const previousId = capture.attachmentId;
      await onChange({
        ...capture,
        attachmentId,
        fingerprint,
        imageName: file.name,
        imageMimeType: file.type,
        imageSize: file.size,
      });
      if (previousId && previousId !== attachmentId) await deleteReceiptAttachment(previousId);
    } finally {
      setIsUpdating(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const removeAttachment = async () => {
    if (!onChange) return;
    const attachmentId = capture.attachmentId;
    await onChange(null);
    await deleteReceiptAttachment(attachmentId);
  };

  return (
    <>
      <div className={`rounded-xl border border-border bg-background/60 ${compact ? 'p-2' : 'p-3'}`}>
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              if (previewUrl) setShowPreview(true);
            }}
            disabled={!previewUrl}
            className="flex min-w-0 items-center gap-2 text-left disabled:cursor-default"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500">
              {previewUrl ? <Eye className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[11px] font-semibold text-primary">{capture.imageName}</span>
              <span className="block text-[9px] text-muted">{previewUrl ? 'Lihat gambar nota' : 'Gambar tidak tersedia di perangkat ini'}</span>
            </span>
          </button>

          {onChange && (
            <div className="flex shrink-0 items-center gap-1">
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => void replaceAttachment(event.target.files?.[0])}
              />
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  inputRef.current?.click();
                }}
                disabled={isUpdating}
                className="rounded-lg p-2 text-muted hover:bg-indigo-500/10 hover:text-indigo-500 disabled:opacity-50"
                title="Ganti gambar nota"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  void removeAttachment();
                }}
                className="rounded-lg p-2 text-muted hover:bg-red-500/10 hover:text-red-500"
                title="Hapus lampiran nota"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {showPreview && previewUrl && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/80 p-4" onClick={() => setShowPreview(false)}>
          <div className="relative max-h-full max-w-4xl" onClick={(event) => event.stopPropagation()}>
            <img src={previewUrl} alt="Gambar nota" className="max-h-[88vh] max-w-full rounded-2xl object-contain" />
            <button
              type="button"
              onClick={() => setShowPreview(false)}
              className="absolute right-2 top-2 rounded-full bg-black/60 p-2 text-white"
              aria-label="Tutup gambar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default ReceiptAttachmentPanel;
