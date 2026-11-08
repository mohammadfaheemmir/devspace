import type { LabelColor } from '../../types/app'

// Light text on a tinted background, like the priority badges.
export const LABEL_STYLES: Record<LabelColor, { chip: string; swatch: string }> = {
    red: { chip: 'border-red-500/40 bg-red-500/15 text-red-200', swatch: 'bg-red-500' },
    orange: { chip: 'border-orange-500/40 bg-orange-500/15 text-orange-200', swatch: 'bg-orange-500' },
    amber: { chip: 'border-amber-500/40 bg-amber-500/15 text-amber-200', swatch: 'bg-amber-500' },
    green: { chip: 'border-green-500/40 bg-green-500/15 text-green-200', swatch: 'bg-green-500' },
    teal: { chip: 'border-teal-500/40 bg-teal-500/15 text-teal-200', swatch: 'bg-teal-500' },
    blue: { chip: 'border-blue-500/40 bg-blue-500/15 text-blue-200', swatch: 'bg-blue-500' },
    purple: { chip: 'border-purple-500/40 bg-purple-500/15 text-purple-200', swatch: 'bg-purple-500' },
    pink: { chip: 'border-pink-500/40 bg-pink-500/15 text-pink-200', swatch: 'bg-pink-500' },
}
