import type { ProjectLabel } from '../../types/app'
import { LABEL_STYLES } from './labelStyles'


// A small coloured label pill.
function LabelChip({ label }: { label: Pick<ProjectLabel, 'name' | 'color'> }) {
    return (
        <span className={`inline-flex max-w-full items-center truncate rounded-full border px-2 py-0.5 text-xs ${LABEL_STYLES[label.color].chip}`}>
            {label.name}
        </span>
    )
}

// Labels for one task, in the project's label order.
export function TaskLabelList({ labels, labelIds }: { labels: readonly ProjectLabel[]; labelIds: readonly string[] | undefined }) {
    if (!labelIds?.length) return null

    const taskLabels = labels.filter((label) => labelIds.includes(label.id))
    if (taskLabels.length === 0) return null

    return (
        <ul className="flex flex-wrap gap-1.5" aria-label="Labels">
            {taskLabels.map((label) => (
                <li key={label.id} className="max-w-full">
                    <LabelChip label={label} />
                </li>
            ))}
        </ul>
    )
}

export default LabelChip
