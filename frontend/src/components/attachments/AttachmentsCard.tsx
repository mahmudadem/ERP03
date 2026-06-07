import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../ui/Card';
import { errorHandler } from '../../services/errorHandler';

export interface AttachmentDTO {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
}

export interface AttachmentsCardProps {
  entityId: string;
  attachments: AttachmentDTO[];
  api: {
    list: (entityId: string) => Promise<AttachmentDTO[]>;
    upload: (entityId: string, file: File) => Promise<unknown>;
    remove: (entityId: string, attachmentId: string) => Promise<unknown>;
    getDownloadLink: (entityId: string, attachmentId: string) => Promise<{ url?: string }>;
  };
  onChange?: (next: AttachmentDTO[]) => void;
  maxSizeMb?: number;
  maxCount?: number;
  allowedTypes?: string;
  i18nNamespace?: string;
  disabled?: boolean;
}

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;

const formatFileSize = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const AttachmentsCard: React.FC<AttachmentsCardProps> = ({
  entityId,
  attachments,
  api,
  onChange,
  maxSizeMb = 10,
  maxCount = 5,
  allowedTypes = '.pdf,.png,.jpg,.jpeg,.docx,.xlsx',
  i18nNamespace = 'common',
  disabled = false,
}) => {
  const { t } = useTranslation();
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [attachmentDeletingId, setAttachmentDeletingId] = useState<string | null>(null);

  const refreshAttachments = async () => {
    try {
      const result = await api.list(entityId);
      const list = unwrap<AttachmentDTO[]>(result);
      const normalized = Array.isArray(list) ? list : [];
      onChange?.(normalized);
    } catch (err: any) {
      errorHandler.showInfo(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          t(`${i18nNamespace}.attachments.error`, 'Failed to refresh attachments.')
      );
    }
  };

  const uploadAttachment = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    // Validate file size
    if (file.size > maxSizeMb * 1024 * 1024) {
      errorHandler.showInfo(
        t(
          `${i18nNamespace}.attachments.fileTooLarge`,
          `File is too large. Maximum size is ${maxSizeMb} MB.`
        )
      );
      return;
    }

    // Validate file count
    if (attachments.length >= maxCount) {
      errorHandler.showInfo(
        t(
          `${i18nNamespace}.attachments.maxFilesReached`,
          `Maximum number of files (${maxCount}) reached.`
        )
      );
      return;
    }

    try {
      setAttachmentBusy(true);
      await api.upload(entityId, file);
      await refreshAttachments();
      errorHandler.showInfo(t(`${i18nNamespace}.attachments.uploadSuccess`, 'Attachment uploaded successfully.'));
    } catch (err: any) {
      errorHandler.showInfo(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          t(`${i18nNamespace}.attachments.uploadError`, 'Failed to upload attachment.')
      );
    } finally {
      setAttachmentBusy(false);
    }
  };

  const removeAttachment = async (attachmentId: string) => {
    try {
      setAttachmentDeletingId(attachmentId);
      await api.remove(entityId, attachmentId);
      await refreshAttachments();
    } catch (err: any) {
      errorHandler.showInfo(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          t(`${i18nNamespace}.attachments.removeError`, 'Failed to remove attachment.')
      );
    } finally {
      setAttachmentDeletingId(null);
    }
  };

  const downloadAttachment = async (attachmentId: string) => {
    try {
      const result = await api.getDownloadLink(entityId, attachmentId);
      const payload = unwrap<{ url?: string }>(result);
      if (!payload?.url) {
        throw new Error(t(`${i18nNamespace}.attachments.downloadError`, 'Failed to generate download link.'));
      }
      window.open(payload.url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      errorHandler.showInfo(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          t(`${i18nNamespace}.attachments.downloadError`, 'Failed to generate download link.')
      );
    }
  };

  return (
    <Card className="p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {t(`${i18nNamespace}.attachments.title`, 'Attachments')}
        </h2>
        {!disabled && (
          <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <input
              type="file"
              className="hidden"
              accept={allowedTypes}
              onChange={uploadAttachment}
              disabled={attachmentBusy || disabled}
            />
            {attachmentBusy
              ? t(`${i18nNamespace}.attachments.uploading`, 'Uploading...')
              : t(`${i18nNamespace}.attachments.upload`, 'Upload Attachment')}
          </label>
        )}
      </div>

      <p className="mb-4 text-xs text-slate-500">
        {t(
          `${i18nNamespace}.attachments.help`,
          `Allowed: PDF, PNG, JPG, DOCX, XLSX. Max ${maxSizeMb} MB per file, ${maxCount} files.`
        )}
      </p>

      {attachments.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
          {t(`${i18nNamespace}.attachments.empty`, 'No attachments yet.')}
        </div>
      ) : (
        <div className="space-y-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                  {attachment.name}
                </div>
                <div className="text-xs text-slate-500">
                  {formatFileSize(attachment.size)} • {attachment.type} • {new Date(attachment.uploadedAt).toLocaleString()}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-50"
                  onClick={() => downloadAttachment(attachment.id)}
                  disabled={disabled}
                >
                  {t(`${i18nNamespace}.attachments.open`, 'Open')}
                </button>
                {!disabled && (
                  <button
                    type="button"
                    className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-700 disabled:opacity-50"
                    onClick={() => removeAttachment(attachment.id)}
                    disabled={attachmentDeletingId === attachment.id}
                  >
                    {attachmentDeletingId === attachment.id
                      ? t(`${i18nNamespace}.attachments.removing`, 'Removing...')
                      : t(`${i18nNamespace}.attachments.remove`, 'Remove')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
