import type { ProjectMember } from '../../types/app'

type MemberAvatarProps = {
    member: Pick<ProjectMember, 'full_name' | 'avatar_url'> | null | undefined
    size?: 'sm' | 'md'
    className?: string
}

const SIZES = {
    sm: 'h-5 w-5 text-[10px]',
    md: 'h-8 w-8 text-xs',
}

// Round avatar: the member's photo, or their initial on an indigo circle.
function MemberAvatar({ member, size = 'md', className = '' }: MemberAvatarProps) {
    const name = member?.full_name || '?'

    return (
        <span
            title={name}
            className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-indigo-500/80 font-semibold text-white ${SIZES[size]} ${className}`}
        >
            {member?.avatar_url ? (
                <img src={member.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
                name.charAt(0).toUpperCase()
            )}
        </span>
    )
}

export default MemberAvatar
