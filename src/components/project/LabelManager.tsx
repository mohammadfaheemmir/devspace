import { useState, type FormEvent } from 'react'
import { Tag, Trash2 } from 'lucide-react'
import { useToast } from '../../context/useToast'
import { getErrorMessage } from '../../lib/errors'
import { createLabel, deleteLabel, MAX_LABEL_NAME_LENGTH } from '../../lib/labelService'
import { LABEL_COLORS, type LabelColor, type ProjectLabel } from '../../types/app'
import LabelChip from './LabelChip'
import { LABEL_STYLES } from './labelStyles'

type LabelManagerProps = {
    projectId: string
    labels: ProjectLabel[]
    onLabelsChange: (labels: ProjectLabel[]) => void
    onError: (message: string) => void
}

// Create and delete a project's labels (owners and admins).
function LabelManager({ projectId, labels, onLabelsChange, onError }: LabelManagerProps) {
    const toast = useToast()
    const [name, setName] = useState('')
    const [color, setColor] = useState<LabelColor>('blue')
    const [saving, setSaving] = useState(false)
    const [deletingId, setDeletingId] = useState<string | null>(null)

    async function handleCreate(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()

        try {
            setSaving(true)
            const label = await createLabel(projectId, name, color)
            onLabelsChange([...labels, label].sort((a, b) => a.name.localeCompare(b.name)))
            setName('')
            toast.success(`Label "${label.name}" created.`)
        } catch (err) {
            onError(getErrorMessage(err, 'Unable to create label.'))
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete(label: ProjectLabel) {
        const confirmed = window.confirm(`Delete the label "${label.name}"? It will be removed from all tasks.`)
        if (!confirmed) return

        try {
            setDeletingId(label.id)
            await deleteLabel(label.id)
            onLabelsChange(labels.filter((item) => item.id !== label.id))
            toast.success(`Label "${label.name}" deleted.`)
        } catch (err) {
            onError(getErrorMessage(err, 'Unable to delete label.'))
        } finally {
            setDeletingId(null)
        }
    }

    return (
        <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl shadow-black/20 sm:p-6">
            <div className="mb-4 flex items-center gap-3">
                <Tag className="text-indigo-400" size={22} />
                <div>
                    <h2 className="text-lg font-semibold">Labels</h2>
                    <p className="text-sm text-slate-400">Colour-coded tags that members can add to tasks.</p>
                </div>
            </div>

            {labels.length === 0 ? (
                <p className="mb-4 text-sm text-slate-400">No labels yet.</p>
            ) : (
                <ul className="mb-5 flex flex-wrap gap-2">
                    {labels.map((label) => (
                        <li key={label.id} className="flex items-center gap-1">
                            <LabelChip label={label} />
                            <button
                                type="button"
                                onClick={() => handleDelete(label)}
                                disabled={deletingId === label.id}
                                aria-label={`Delete label ${label.name}`}
                                className="rounded p-1 text-slate-400 transition hover:bg-slate-800 hover:text-red-300 disabled:opacity-50"
                            >
                                <Trash2 size={13} />
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            <form onSubmit={handleCreate} className="flex flex-col gap-3 border-t border-slate-800 pt-4 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                    <label htmlFor="new-label-name" className="mb-2 block text-sm text-slate-300">New label</label>
                    <input
                        id="new-label-name"
                        type="text"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        maxLength={MAX_LABEL_NAME_LENGTH}
                        placeholder="e.g. Bug"
                        required
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
                    />
                </div>

                <fieldset>
                    <legend className="mb-2 text-sm text-slate-300">Colour</legend>
                    <div className="flex flex-wrap gap-2">
                        {LABEL_COLORS.map((option) => (
                            <label key={option} className="cursor-pointer" title={option}>
                                <input
                                    type="radio"
                                    name="new-label-color"
                                    value={option}
                                    checked={color === option}
                                    onChange={() => setColor(option)}
                                    className="peer sr-only"
                                />
                                <span className="sr-only">{option}</span>
                                <span
                                    aria-hidden="true"
                                    className={`block h-7 w-7 rounded-full ${LABEL_STYLES[option].swatch} ring-offset-2 ring-offset-slate-900 peer-checked:ring-2 peer-checked:ring-white peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-400`}
                                />
                            </label>
                        ))}
                    </div>
                </fieldset>

                <button
                    type="submit"
                    disabled={saving || !name.trim()}
                    className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {saving ? 'Adding...' : 'Add label'}
                </button>
            </form>
        </section>
    )
}

export default LabelManager
