import { supabase } from './supabase'
import { getCurrentUser } from './auth'
import type { Tables } from '../types/database'

export type TaskAttachment = Tables<'task_attachments'>

const BUCKET = 'task-attachments'

// Must match the bucket settings in migration 20261109000100.
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
export const ALLOWED_ATTACHMENT_TYPES: readonly string[] = [
    'image/png', 'image/jpeg', 'image/webp', 'image/gif',
    'application/pdf',
    'text/plain', 'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]

// For the file picker's `accept` attribute.
export const ATTACHMENT_ACCEPT = ALLOWED_ATTACHMENT_TYPES.join(',')

// Check a file before uploading; returns an error message, or null if OK.
export function validateAttachment(file: Pick<File, 'name' | 'size' | 'type'>): string | null {
    if (!file.name.trim()) return 'The file has no name.'
    if (file.size === 0) return `"${file.name}" is empty.`
    if (file.size > MAX_ATTACHMENT_BYTES) return `"${file.name}" is larger than 10 MB.`
    if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type)) {
        return `"${file.name}" is not a supported file type. Use images, PDF, text or Office files.`
    }
    return null
}

// Storage keys allow a limited character set; keep the original name in
// the database record and use a safe version in the path.
export function toSafeFileName(name: string): string {
    const safe = name
        .normalize('NFKD')
        .replace(/[^\w.-]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^[._]+/, '')
        .slice(-100)
    return safe || 'file'
}

export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// A task's attachments, oldest first.
export async function getTaskAttachments(taskId: string): Promise<TaskAttachment[]> {
    await getCurrentUser()

    if (!taskId) throw new Error('Task ID is required.')

    const { data, error } = await supabase
        .from('task_attachments')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true })

    if (error) throw new Error(error.message)

    return data || []
}

// Upload a file and record it. If recording fails, the uploaded file is
// removed again so no orphaned file is left behind.
export async function uploadAttachment(projectId: string, taskId: string, file: File): Promise<TaskAttachment> {
    const user = await getCurrentUser()

    if (!projectId || !taskId) throw new Error('Project ID and task ID are required.')

    const problem = validateAttachment(file)
    if (problem) throw new Error(problem)

    const storagePath = `${projectId}/${taskId}/${crypto.randomUUID()}-${toSafeFileName(file.name)}`

    const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, file, { contentType: file.type, upsert: false })

    if (uploadError) throw new Error(uploadError.message)

    const { data, error } = await supabase
        .from('task_attachments')
        .insert({
            task_id: taskId,
            project_id: projectId,
            uploaded_by: user.id,
            file_name: file.name.slice(0, 255),
            storage_path: storagePath,
            size_bytes: file.size,
            mime_type: file.type,
        })
        .select()
        .single()

    if (error) {
        await supabase.storage.from(BUCKET).remove([storagePath])
        throw new Error(error.message)
    }

    return data
}

// A short-lived link (60 seconds) that downloads the file under its
// original name.
export async function getAttachmentDownloadUrl(attachment: Pick<TaskAttachment, 'storage_path' | 'file_name'>): Promise<string> {
    await getCurrentUser()

    const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(attachment.storage_path, 60, { download: attachment.file_name })

    if (error || !data) throw new Error(error?.message || 'Unable to create a download link.')

    return data.signedUrl
}

// Delete an attachment. The record goes first: Row Level Security makes
// that the permission check. Then the file is removed.
export async function deleteAttachment(attachment: Pick<TaskAttachment, 'id' | 'storage_path'>): Promise<true> {
    await getCurrentUser()

    const { data, error } = await supabase
        .from('task_attachments')
        .delete()
        .eq('id', attachment.id)
        .select('id')

    if (error) throw new Error(error.message)

    if (!data || data.length === 0) {
        throw new Error('Attachment was not deleted. Only the uploader or a project admin can delete it.')
    }

    const { error: removeError } = await supabase.storage.from(BUCKET).remove([attachment.storage_path])
    if (removeError) console.warn('Attachment record deleted, but the file could not be removed:', removeError.message)

    return true
}

// Best-effort removal of all files in a folder (one level of subfolders).
// Used before deleting a task or project, because Supabase does not let the
// database delete files when those rows cascade away.
async function removeFolder(prefix: string, depth: number): Promise<void> {
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000 })
    if (error || !data) return

    const files = data.filter((entry) => entry.id).map((entry) => `${prefix}/${entry.name}`)
    const folders = data.filter((entry) => !entry.id).map((entry) => `${prefix}/${entry.name}`)

    if (files.length > 0) {
        const { error: removeError } = await supabase.storage.from(BUCKET).remove(files)
        if (removeError) console.warn(`Could not remove files in ${prefix}:`, removeError.message)
    }

    if (depth > 0) {
        for (const folder of folders) await removeFolder(folder, depth - 1)
    }
}

export async function removeTaskFiles(projectId: string, taskId: string): Promise<void> {
    if (!projectId || !taskId) return
    await removeFolder(`${projectId}/${taskId}`, 0)
}

export async function removeProjectFiles(projectId: string): Promise<void> {
    if (!projectId) return
    await removeFolder(projectId, 1)
}
