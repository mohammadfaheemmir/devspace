import type { ProjectRole } from '../../types/app'

// Badge colours for project roles (dashboard cards, member list).
export const ROLE_BADGE: Record<ProjectRole, string> = {
    owner: 'bg-amber-500/10 text-amber-400',
    admin: 'bg-purple-500/10 text-purple-400',
    member: 'bg-indigo-500/10 text-indigo-400',
}
