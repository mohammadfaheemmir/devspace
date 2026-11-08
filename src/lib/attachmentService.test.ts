import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createQuery } from '../test/supabaseMock'
import { fakeFile, makeUser } from '../test/fixtures'

const bucket = {
    upload: vi.fn(),
    remove: vi.fn(),
    list: vi.fn(),
    createSignedUrl: vi.fn(),
}

vi.mock('./supabase', () => ({
    supabase: { from: vi.fn(), storage: { from: vi.fn(() => bucket) } },
}))
vi.mock('./auth', () => ({ getCurrentUser: vi.fn() }))

const { supabase } = await import('./supabase')
const { getCurrentUser } = await import('./auth')
const {
    deleteAttachment,
    formatFileSize,
    getAttachmentDownloadUrl,
    removeProjectFiles,
    toSafeFileName,
    uploadAttachment,
    validateAttachment,
} = await import('./attachmentService')

type FileFields = { name: string; size: number; type: string }
const pdfFields = (overrides: Partial<FileFields> = {}): FileFields =>
    ({ name: 'Spec v2.pdf', size: 2048, type: 'application/pdf', ...overrides })
const pdf = (overrides: Partial<FileFields> = {}): File => {
    const { name, type, size } = pdfFields(overrides)
    return fakeFile(name, type, size)
}

beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUser).mockResolvedValue(makeUser())
    vi.mocked(bucket.upload).mockResolvedValue({ data: {}, error: null })
    vi.mocked(bucket.remove).mockResolvedValue({ data: [], error: null })
})

describe('validateAttachment', () => {
    it('accepts supported files up to 10 MB', () => {
        expect(validateAttachment(pdfFields())).toBeNull()
        expect(validateAttachment(pdfFields({ size: 10 * 1024 * 1024 }))).toBeNull()
    })

    it('rejects empty, oversized and unsupported files', () => {
        expect(validateAttachment(pdfFields({ size: 0 }))).toMatch(/is empty/)
        expect(validateAttachment(pdfFields({ size: 10 * 1024 * 1024 + 1 }))).toMatch(/larger than 10 MB/)
        expect(validateAttachment(pdfFields({ name: 'page.html', type: 'text/html' }))).toMatch(/not a supported file type/)
        expect(validateAttachment(pdfFields({ name: 'logo.svg', type: 'image/svg+xml' }))).toMatch(/not a supported file type/)
    })
})

describe('toSafeFileName', () => {
    it('keeps safe characters and replaces the rest', () => {
        expect(toSafeFileName('Spec v2 (final).pdf')).toBe('Spec_v2_final_.pdf')
        expect(toSafeFileName('../../etc/passwd')).toBe('etc_passwd')
        expect(toSafeFileName('???')).toBe('file')
    })
})

describe('formatFileSize', () => {
    it('uses B, KB and MB', () => {
        expect(formatFileSize(512)).toBe('512 B')
        expect(formatFileSize(2048)).toBe('2 KB')
        expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB')
    })
})

describe('uploadAttachment', () => {
    it('uploads under project/task/random-name and records the original name', async () => {
        const insert = createQuery({ data: { id: 'a1' }, error: null })
        vi.mocked(supabase.from).mockReturnValue(insert)

        await uploadAttachment('p1', 't1', pdf())

        const [path, , options] = vi.mocked(bucket.upload).mock.calls[0] ?? []
        expect(path).toMatch(/^p1\/t1\/[0-9a-f-]{36}-Spec_v2.pdf$/)
        expect(options).toEqual({ contentType: 'application/pdf', upsert: false })
        expect(insert.insert).toHaveBeenCalledWith(expect.objectContaining({
            task_id: 't1',
            project_id: 'p1',
            uploaded_by: 'user-1',
            file_name: 'Spec v2.pdf',
            storage_path: path,
            size_bytes: 2048,
        }))
    })

    it('removes the uploaded file again if recording it fails', async () => {
        vi.mocked(supabase.from).mockReturnValue(createQuery({ data: null, error: { message: 'denied' } }))

        await expect(uploadAttachment('p1', 't1', pdf())).rejects.toThrow('denied')

        const uploadedPath = vi.mocked(bucket.upload).mock.calls[0]?.[0]
        expect(bucket.remove).toHaveBeenCalledWith([uploadedPath])
    })

    it('does not upload invalid files', async () => {
        await expect(uploadAttachment('p1', 't1', pdf({ type: 'text/html' }))).rejects.toThrow(/not a supported/)
        expect(bucket.upload).not.toHaveBeenCalled()
    })
})

describe('getAttachmentDownloadUrl', () => {
    it('creates a 60-second link that downloads under the original name', async () => {
        vi.mocked(bucket.createSignedUrl).mockResolvedValue({ data: { signedUrl: 'https://signed' }, error: null })

        await expect(getAttachmentDownloadUrl({ storage_path: 'p1/t1/x-a.pdf', file_name: 'a.pdf' })).resolves.toBe('https://signed')
        expect(bucket.createSignedUrl).toHaveBeenCalledWith('p1/t1/x-a.pdf', 60, { download: 'a.pdf' })
    })
})

describe('deleteAttachment', () => {
    it('deletes the record first, then the file', async () => {
        vi.mocked(supabase.from).mockReturnValue(createQuery({ data: [{ id: 'a1' }], error: null }))

        await deleteAttachment({ id: 'a1', storage_path: 'p1/t1/x-a.pdf' })

        expect(bucket.remove).toHaveBeenCalledWith(['p1/t1/x-a.pdf'])
    })

    it('keeps the file when the database refuses the delete', async () => {
        vi.mocked(supabase.from).mockReturnValue(createQuery({ data: [], error: null }))

        await expect(deleteAttachment({ id: 'a1', storage_path: 'p1/t1/x-a.pdf' })).rejects.toThrow(/Only the uploader or a project admin/)
        expect(bucket.remove).not.toHaveBeenCalled()
    })
})

describe('removeProjectFiles', () => {
    it('removes the files in every task folder of the project', async () => {
        vi.mocked(bucket.list).mockImplementation(async (prefix) => {
            if (prefix === 'p1') return { data: [{ id: null, name: 't1' }, { id: null, name: 't2' }], error: null }
            if (prefix === 'p1/t1') return { data: [{ id: 'f1', name: 'a.pdf' }], error: null }
            if (prefix === 'p1/t2') return { data: [{ id: 'f2', name: 'b.png' }, { id: 'f3', name: 'c.txt' }], error: null }
            return { data: [], error: null }
        })

        await removeProjectFiles('p1')

        expect(bucket.remove).toHaveBeenCalledWith(['p1/t1/a.pdf'])
        expect(bucket.remove).toHaveBeenCalledWith(['p1/t2/b.png', 'p1/t2/c.txt'])
    })
})
