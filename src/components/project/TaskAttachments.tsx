import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Download, File as FileIcon, FileImage, FileText, LoaderCircle, Paperclip, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { getErrorMessage } from '../../lib/errors'
import { useToast } from '../../context/useToast'
import {
    ATTACHMENT_ACCEPT,
    deleteAttachment,
    formatFileSize,
    getAttachmentDownloadUrl,
    getTaskAttachments,
    uploadAttachment,
    validateAttachment,
    type TaskAttachment,
} from '../../lib/attachmentService'

type TaskAttachmentsProps = {
    projectId: string
    taskId: string
    currentUserId: string | null
    isProjectAdmin: boolean
    /** The task's creator may also delete its attachments. */
    taskCreatedBy?: string | null
    onError: (message: string) => void
}

function iconFor(mimeType: string) {
    if (mimeType.startsWith('image/')) return FileImage
    if (mimeType === 'application/pdf' || mimeType.startsWith('text/')) return FileText
    return FileIcon
}

// Files attached to a task: list, upload, download and delete.
function TaskAttachments({ projectId, taskId, currentUserId, isProjectAdmin, taskCreatedBy = null, onError }: TaskAttachmentsProps) {
    const toast = useToast()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [attachments, setAttachments] = useState<TaskAttachment[]>([])
    const [loading, setLoading] = useState(true)
    const [uploading, setUploading] = useState(false)
    const [busyId, setBusyId] = useState<string | null>(null)

    // Latest list for the Realtime delete handler (created once per task).
    const attachmentsRef = useRef(attachments)
    useEffect(() => {
        attachmentsRef.current = attachments
    }, [attachments])

    // Load, and keep in sync when teammates add or remove files.
    useEffect(() => {
        let active = true

        async function load() {
            try {
                const data = await getTaskAttachments(taskId)
                if (active) setAttachments(data)
            } catch (err) {
                if (active) onError(getErrorMessage(err, 'Unable to load attachments.'))
            } finally {
                if (active) setLoading(false)
            }
        }

        load()

        // DELETE events cannot be filtered by column, and Supabase does not
        // apply RLS to them, so deletes from every project arrive here (only
        // their IDs). Reload only when one of this task's files was deleted.
        function onDeleted(payload: { old: { id?: string } }) {
            if (attachmentsRef.current.some((item) => item.id === payload.old.id)) load()
        }

        const channel = supabase
            .channel(`task-attachments-${taskId}-${crypto.randomUUID()}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'task_attachments', filter: `task_id=eq.${taskId}` }, load)
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'task_attachments' }, onDeleted)
            .subscribe()

        return () => {
            active = false
            supabase.removeChannel(channel)
        }
    }, [taskId, onError])

    async function handleFilesChosen(event: ChangeEvent<HTMLInputElement>) {
        const files = [...(event.target.files ?? [])]
        event.target.value = ''
        if (files.length === 0) return

        setUploading(true)
        let uploaded = 0

        for (const file of files) {
            const problem = validateAttachment(file)
            if (problem) {
                onError(problem)
                continue
            }

            try {
                const attachment = await uploadAttachment(projectId, taskId, file)
                setAttachments((current) =>
                    current.some((item) => item.id === attachment.id) ? current : [...current, attachment]
                )
                uploaded += 1
            } catch (err) {
                onError(getErrorMessage(err, `Unable to upload "${file.name}".`))
            }
        }

        setUploading(false)
        if (uploaded > 0) toast.success(uploaded === 1 ? 'File attached.' : `${uploaded} files attached.`)
    }

    async function handleDownload(attachment: TaskAttachment) {
        try {
            setBusyId(attachment.id)
            const url = await getAttachmentDownloadUrl(attachment)
            // The link is a download (Content-Disposition), so the page stays.
            window.location.assign(url)
        } catch (err) {
            onError(getErrorMessage(err, 'Unable to download the file.'))
        } finally {
            setBusyId(null)
        }
    }

    async function handleDelete(attachment: TaskAttachment) {
        if (!window.confirm(`Delete "${attachment.file_name}"? This cannot be undone.`)) return

        try {
            setBusyId(attachment.id)
            await deleteAttachment(attachment)
            setAttachments((current) => current.filter((item) => item.id !== attachment.id))
            toast.success('Attachment deleted.')
        } catch (err) {
            onError(getErrorMessage(err, 'Unable to delete the attachment.'))
        } finally {
            setBusyId(null)
        }
    }

    return (
        <section aria-labelledby={`attachments-${taskId}`} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
                <h3 id={`attachments-${taskId}`} className="flex items-center gap-2 text-sm font-medium text-slate-300">
                    <Paperclip size={15} />
                    Attachments {!loading && `(${attachments.length})`}
                </h3>

                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-slate-800 hover:text-white disabled:opacity-50"
                >
                    {uploading ? <LoaderCircle size={14} className="animate-spin" /> : <Paperclip size={14} />}
                    {uploading ? 'Uploading...' : 'Attach files'}
                </button>

                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={ATTACHMENT_ACCEPT}
                    onChange={handleFilesChosen}
                    className="hidden"
                    aria-label="Choose files to attach"
                />
            </div>

            {loading ? (
                <p className="text-xs text-slate-400">Loading attachments...</p>
            ) : attachments.length === 0 ? (
                <p className="text-xs text-slate-400">No files yet. Images, PDF, text and Office files up to 10 MB.</p>
            ) : (
                <ul className="space-y-2">
                    {attachments.map((attachment) => {
                        const Icon = iconFor(attachment.mime_type)
                        // Mirrors the database rule: uploader, task creator, or owner/admin.
                        const canDelete =
                            attachment.uploaded_by === currentUserId ||
                            (currentUserId !== null && taskCreatedBy === currentUserId) ||
                            isProjectAdmin
                        const busy = busyId === attachment.id

                        return (
                            <li key={attachment.id} className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2">
                                <Icon size={18} className="shrink-0 text-indigo-300" />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm text-slate-200" title={attachment.file_name}>
                                        {attachment.file_name}
                                    </p>
                                    <p className="text-xs text-slate-400">{formatFileSize(attachment.size_bytes)}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleDownload(attachment)}
                                    disabled={busy}
                                    aria-label={`Download ${attachment.file_name}`}
                                    className="rounded p-1.5 text-slate-300 transition hover:bg-slate-800 hover:text-white disabled:opacity-50"
                                >
                                    <Download size={15} />
                                </button>
                                {canDelete && (
                                    <button
                                        type="button"
                                        onClick={() => handleDelete(attachment)}
                                        disabled={busy}
                                        aria-label={`Delete ${attachment.file_name}`}
                                        className="rounded p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-red-300 disabled:opacity-50"
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                )}
                            </li>
                        )
                    })}
                </ul>
            )}
        </section>
    )
}

export default TaskAttachments
