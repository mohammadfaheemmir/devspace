
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
    ArrowLeft,
    Plus,
    X,
    ClipboardList,
    CheckCircle2,
    Clock3,
    Circle,
    Users,
    UserRound,
    Mail,
    Send,
    Trash2,
    MessageCircle,
    Activity,
    UserPlus,
    UserCheck,
    UserMinus,
    ListTodo,
    RefreshCw,
    LoaderCircle,
    Search,
    SlidersHorizontal,
    Bell,
    AlertCircle,
    CalendarClock,
    CheckCheck,
} from 'lucide-react'

import { supabase } from '../lib/supabase'
import { getCurrentUser } from '../lib/auth'

import {
    getTasks,
    createTask,
    updateTaskStatus,
    updateTaskAssignee,
} from '../lib/taskService'

import {
    getProjectMembers,
    transferProjectOwnership,
    updateProjectMemberRole,
    removeProjectMember,
    leaveProject,
} from '../lib/projectMemberService'

import {
    createProjectInvitation,
    getProjectInvitations,
    cancelProjectInvitation,
} from '../lib/invitationService'

import {
    getTaskComments,
    createTaskComment,
    deleteTaskComment,
} from '../lib/commentService'

import { getProjectActivities } from '../lib/activityService'
import { deleteProject, updateProject } from '../lib/projectService'

// Date-only helpers avoid timezone shifts when parsing Supabase DATE values.
function getLocalDateString() {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

function formatDueDate(dateValue) {
    if (!dateValue) return ''
    const [year, month, day] = String(dateValue).split('-').map(Number)
    if (!year || !month || !day) return String(dateValue)
    return new Intl.DateTimeFormat(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    }).format(new Date(year, month - 1, day))
}

function isTaskOverdue(task) {
    return Boolean(
        task.due_date &&
        task.status !== 'done' &&
        task.due_date < getLocalDateString()
    )
}

// Shared priority badge colours so list and board views look the same.
function getPriorityBadgeClasses(priority) {
    if (priority === 'high') return 'bg-red-500/10 text-red-400'
    if (priority === 'low') return 'bg-green-500/10 text-green-400'
    return 'bg-yellow-500/10 text-yellow-400'
}

function TaskKanbanBoard({ tasks = [], members = [], onStatusChange, updatingTaskIds = [] }) {
    const [draggedTaskId, setDraggedTaskId] = useState(null)
    const [dragOverColumn, setDragOverColumn] = useState(null)

    const columns = [
        { id: 'todo', title: 'To Do', icon: Circle, color: 'text-slate-400' },
        { id: 'in_progress', title: 'In Progress', icon: Clock3, color: 'text-yellow-400' },
        { id: 'done', title: 'Done', icon: CheckCircle2, color: 'text-green-400' },
    ]

    function getMemberName(userId) {
        const member = members.find((item) => item.user_id === userId)
        return member?.full_name || 'Unknown member'
    }

    function handleDrop(status) {
        if (!draggedTaskId) return
        const task = tasks.find((item) => item.id === draggedTaskId)
        if (task && task.status !== status) onStatusChange(task.id, status)
        setDraggedTaskId(null)
        setDragOverColumn(null)
    }

    return (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {columns.map((column) => {
                const Icon = column.icon
                const columnTasks = tasks.filter((task) => task.status === column.id)

                return (
                    <section
                        key={column.id}
                        onDragOver={(event) => {
                            event.preventDefault()
                            setDragOverColumn(column.id)
                        }}
                        onDragLeave={(event) => {
                            if (!event.currentTarget.contains(event.relatedTarget)) {
                                setDragOverColumn(null)
                            }
                        }}
                        onDrop={(event) => {
                            event.preventDefault()
                            handleDrop(column.id)
                        }}
                        className={`min-h-[300px] rounded-xl border p-4 transition ${dragOverColumn === column.id
                            ? 'border-indigo-500 bg-indigo-500/10'
                            : 'border-slate-800 bg-slate-900'
                            }`}
                    >
                        <div className="mb-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Icon size={19} className={column.color} />
                                <h3 className="font-semibold">{column.title}</h3>
                            </div>
                            <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-300">
                                {columnTasks.length}
                            </span>
                        </div>

                        <div className="space-y-3">
                            {columnTasks.map((task) => (
                                <article
                                    key={task.id}
                                    draggable={!updatingTaskIds.includes(task.id)}
                                    onDragStart={(event) => {
                                        event.dataTransfer.effectAllowed = 'move'
                                        event.dataTransfer.setData('text/plain', task.id)
                                        setDraggedTaskId(task.id)
                                    }}
                                    onDragEnd={() => {
                                        setDraggedTaskId(null)
                                        setDragOverColumn(null)
                                    }}
                                    className={`rounded-lg border border-slate-700 bg-slate-950 p-4 transition hover:border-indigo-500 ${draggedTaskId === task.id ? 'opacity-40' : ''
                                        } ${updatingTaskIds.includes(task.id) ? 'opacity-60' : 'cursor-grab active:cursor-grabbing'}`}
                                >
                                    <h4 className="break-words font-medium text-slate-100">{task.title}</h4>
                                    {task.description && (
                                        <p className="mt-2 break-words text-sm text-slate-400">{task.description}</p>
                                    )}
                                    <div className="mt-3 flex flex-wrap items-center gap-2">
                                        <span className={`rounded-full px-2.5 py-1 text-xs capitalize ${getPriorityBadgeClasses(task.priority)}`}>
                                            {task.priority || 'medium'} priority
                                        </span>
                                    </div>
                                    {task.due_date && (
                                        <p className={`mt-3 flex items-center gap-2 text-xs ${isTaskOverdue(task)
                                            ? 'text-red-400'
                                            : task.status === 'done'
                                                ? 'text-green-400'
                                                : 'text-slate-400'
                                            }`}>
                                            <Clock3 size={14} />
                                            {isTaskOverdue(task)
                                                ? `Overdue · ${formatDueDate(task.due_date)}`
                                                : `Due ${formatDueDate(task.due_date)}`}
                                        </p>
                                    )}
                                    <p className="mt-3 text-xs text-slate-400">
                                        Assigned to: {task.assignee_id ? getMemberName(task.assignee_id) : 'Unassigned'}
                                    </p>
                                    <select
                                        value={task.status}
                                        disabled={updatingTaskIds.includes(task.id)}
                                        onChange={(event) => onStatusChange(task.id, event.target.value)}
                                        className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-300 outline-none focus:border-indigo-500 disabled:opacity-50"
                                        aria-label={`Change status for ${task.title}`}
                                    >
                                        <option value="todo">To Do</option>
                                        <option value="in_progress">In Progress</option>
                                        <option value="done">Done</option>
                                    </select>
                                </article>
                            ))}
                            {columnTasks.length === 0 && (
                                <div className="rounded-lg border border-dashed border-slate-700 p-6 text-center text-sm text-slate-500">
                                    No tasks in this column
                                </div>
                            )}
                        </div>
                    </section>
                )
            })}
        </div>
    )
}

function ProjectDetails() {
    const { projectId } = useParams()
    const navigate = useNavigate()

    const [project, setProject] = useState(null)
    const [tasks, setTasks] = useState([])
    const [members, setMembers] = useState([])
    const [invitations, setInvitations] = useState([])
    const [activities, setActivities] = useState([])
    const [currentUserId, setCurrentUserId] = useState(null)

    const [loading, setLoading] = useState(true)
    const [loadingActivities, setLoadingActivities] = useState(true)
    const [activityError, setActivityError] = useState('')
    const [error, setError] = useState('')

    const [showTaskForm, setShowTaskForm] = useState(false)
    const [saving, setSaving] = useState(false)
    const [updatingTaskIds, setUpdatingTaskIds] = useState([])
    const [showNotifications, setShowNotifications] = useState(false)
    const [readNotificationIds, setReadNotificationIds] = useState(() => {
        try {
            const saved = localStorage.getItem(`task-notifications-read-${projectId}`)
            return saved ? JSON.parse(saved) : []
        } catch {
            return []
        }
    })

    // Save which reminders were read. Only IDs that still match an existing
    // task and due date are kept, so storage does not grow forever.
    useEffect(() => {
        if (loading) return

        const validIds = new Set(
            tasks
                .filter((task) => task.due_date)
                .map((task) => `${task.id}-${task.due_date}`)
        )

        try {
            localStorage.setItem(
                `task-notifications-read-${projectId}`,
                JSON.stringify(
                    readNotificationIds.filter((id) => validIds.has(id))
                )
            )
        } catch (storageError) {
            console.warn('Unable to save notification read state:', storageError)
        }
    }, [readNotificationIds, projectId, tasks, loading])

    // Task search, filters and sorting.
    const [taskSearch, setTaskSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [priorityFilter, setPriorityFilter] = useState('all')
    const [assigneeFilter, setAssigneeFilter] = useState('all')
    const [taskSort, setTaskSort] = useState('newest')
    const [taskView, setTaskView] = useState('list')

    const [invitationEmail, setInvitationEmail] = useState('')
    const [invitationSaving, setInvitationSaving] = useState(false)
    const [cancellingInvitationId, setCancellingInvitationId] = useState(null)
    const [selectedNewOwnerId, setSelectedNewOwnerId] = useState('')
    const [transferringOwnership, setTransferringOwnership] = useState(false)
    const [updatingMemberRoleId, setUpdatingMemberRoleId] = useState(null)
    const [removingMemberId, setRemovingMemberId] = useState(null)
    const [leavingProject, setLeavingProject] = useState(false)
    const [deletingProject, setDeletingProject] = useState(false)
    const [showProjectSettings, setShowProjectSettings] = useState(false)
    const [savingProjectSettings, setSavingProjectSettings] = useState(false)
    const [projectSettingsName, setProjectSettingsName] = useState('')
    const [projectSettingsDescription, setProjectSettingsDescription] = useState('')

    const [expandedTaskId, setExpandedTaskId] = useState(null)
    const [commentsByTask, setCommentsByTask] = useState({})
    const [commentDrafts, setCommentDrafts] = useState({})
    const [loadingCommentsTaskId, setLoadingCommentsTaskId] = useState(null)
    const [sendingCommentTaskId, setSendingCommentTaskId] = useState(null)
    const [deletingCommentId, setDeletingCommentId] = useState(null)

    const [taskForm, setTaskForm] = useState({
        title: '',
        description: '',
        priority: 'medium',
        assignee_id: '',
        due_date: '',
    })

    const isProjectAdmin = members.some(
        (member) =>
            member.user_id === currentUserId &&
            ['owner', 'admin'].includes(member.role)
    )

    const isProjectOwner = members.some(
        (member) =>
            member.user_id === currentUserId &&
            member.role === 'owner'
    )

    // Load project, tasks, members, invitations and activities.
    // Activity failures do not prevent the main workspace from loading.
    useEffect(() => {
        let active = true

        async function loadProjectData() {
            try {
                setLoading(true)
                setLoadingActivities(true)
                setError('')
                setActivityError('')

                const user = await getCurrentUser()

                const { data: projectData, error: projectError } =
                    await supabase
                        .from('projects')
                        .select('*')
                        .eq('id', projectId)
                        .single()

                if (projectError) throw projectError

                // Load essential workspace data first.
                const [taskData, memberData] = await Promise.all([
                    getTasks(projectId),
                    getProjectMembers(projectId),
                ])

                const currentMember = memberData.find(
                    (member) => member.user_id === user.id
                )

                let invitationData = []

                if (
                    currentMember &&
                    ['owner', 'admin'].includes(currentMember.role)
                ) {
                    invitationData = await getProjectInvitations(projectId)
                }

                if (!active) return

                setCurrentUserId(user.id)
                setProject(projectData)
                setTasks(taskData)
                setMembers(memberData)
                setInvitations(invitationData)

                // Load activity separately so it cannot break the workspace.
                try {
                    const activityData = await getProjectActivities(projectId)

                    if (!active) return

                    setActivities(activityData)
                    setActivityError('')
                } catch (activityErr) {
                    if (!active) return

                    setActivities([])
                    setActivityError(
                        activityErr.message ||
                        'Unable to load project activities.'
                    )
                }
            } catch (err) {
                if (active) {
                    setError(err.message || 'Unable to load project.')
                }
            } finally {
                if (active) {
                    setLoading(false)
                    setLoadingActivities(false)
                }
            }
        }

        loadProjectData()

        return () => {
            active = false
        }
    }, [projectId])

    // Refresh activity history manually.
    async function refreshActivities() {
        try {
            setLoadingActivities(true)
            setActivityError('')

            const data = await getProjectActivities(projectId)
            setActivities(data)
        } catch (err) {
            setActivityError(
                err.message || 'Unable to refresh project activities.'
            )
        } finally {
            setLoadingActivities(false)
        }
    }

    // Real-time subscription for project activities.
    useEffect(() => {
        if (!projectId) return

        let active = true

        const channel = supabase
            .channel(`project-activities-${projectId}-${crypto.randomUUID()}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'project_activities',
                    filter: `project_id=eq.${projectId}`,
                },
                async () => {
                    try {
                        const updatedActivities =
                            await getProjectActivities(projectId)

                        if (!active) return

                        setActivities(updatedActivities)
                        setActivityError('')
                    } catch (err) {
                        if (!active) return

                        setActivityError(
                            err.message ||
                            'Unable to refresh project activities.'
                        )
                    }
                }
            )
            .subscribe((status) => {
                if (
                    status === 'CHANNEL_ERROR' ||
                    status === 'TIMED_OUT'
                ) {
                    console.error(
                        'Realtime activities subscription error:',
                        status
                    )
                }
            })

        return () => {
            active = false
            supabase.removeChannel(channel)
        }
    }, [projectId])

    // Real-time subscription for project comments.
    useEffect(() => {
        if (!projectId) return

        let active = true

        // Inserts and updates are filtered by project on the server.
        // Supabase cannot filter DELETE events by column, so deletes are
        // received unfiltered and matched by ID (unknown IDs are ignored).
        const projectFilter = `project_id=eq.${projectId}`

        const handleCommentChange = async (payload) => {
            if (
                payload.eventType === 'INSERT' ||
                payload.eventType === 'UPDATE'
            ) {
                const changedComment = payload.new

                if (changedComment.project_id !== projectId) return

                const taskId = changedComment.task_id

                try {
                    const updatedComments =
                        await getTaskComments(taskId)

                    if (!active) return

                    setCommentsByTask((previous) => ({
                        ...previous,
                        [taskId]: updatedComments,
                    }))
                } catch (err) {
                    console.error(
                        'Unable to refresh realtime comments:',
                        err
                    )
                }
            }

            if (payload.eventType === 'DELETE') {
                const deletedCommentId = payload.old.id

                if (!deletedCommentId) return

                setCommentsByTask((previous) => {
                    const updated = { ...previous }

                    Object.keys(updated).forEach((taskId) => {
                        updated[taskId] = updated[taskId].filter(
                            (comment) =>
                                comment.id !== deletedCommentId
                        )
                    })

                    return updated
                })
            }
        }

        const channel = supabase
            .channel(`project-comments-${projectId}-${crypto.randomUUID()}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'comments', filter: projectFilter },
                handleCommentChange
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'comments', filter: projectFilter },
                handleCommentChange
            )
            .on(
                'postgres_changes',
                { event: 'DELETE', schema: 'public', table: 'comments' },
                handleCommentChange
            )
            .subscribe((status) => {
                if (
                    status === 'CHANNEL_ERROR' ||
                    status === 'TIMED_OUT'
                ) {
                    console.error(
                        'Realtime comments subscription error:',
                        status
                    )
                }
            })

        return () => {
            active = false
            supabase.removeChannel(channel)
        }
    }, [projectId])

    // Real-time subscription for project tasks.
    useEffect(() => {
        if (!projectId) return

        // Inserts and updates are filtered by project on the server.
        // Supabase cannot filter DELETE events by column, so deletes are
        // received unfiltered and matched by ID (unknown IDs are ignored).
        const projectFilter = `project_id=eq.${projectId}`

        const handleTaskChange = (payload) => {
            if (payload.eventType === 'INSERT') {
                const newTask = payload.new

                if (newTask.project_id !== projectId) return

                setTasks((previous) => {
                    const withoutDuplicate = previous.filter(
                        (task) => task.id !== newTask.id
                    )

                    return [newTask, ...withoutDuplicate].sort(
                        (a, b) =>
                            new Date(b.created_at) -
                            new Date(a.created_at)
                    )
                })
            }

            if (payload.eventType === 'UPDATE') {
                const updatedTask = payload.new

                if (updatedTask.project_id !== projectId) return

                setTasks((previous) => {
                    const taskExists = previous.some(
                        (task) => task.id === updatedTask.id
                    )

                    if (!taskExists) {
                        return [updatedTask, ...previous]
                    }

                    return previous.map((task) =>
                        task.id === updatedTask.id
                            ? { ...task, ...updatedTask }
                            : task
                    )
                })
            }

            if (payload.eventType === 'DELETE') {
                const deletedTaskId = payload.old.id

                if (!deletedTaskId) return

                setTasks((previous) =>
                    previous.filter(
                        (task) => task.id !== deletedTaskId
                    )
                )

                setCommentsByTask((previous) => {
                    const updated = { ...previous }
                    delete updated[deletedTaskId]
                    return updated
                })

                setExpandedTaskId((previous) =>
                    previous === deletedTaskId ? null : previous
                )
            }
        }

        const channel = supabase
            .channel(`project-tasks-${projectId}-${crypto.randomUUID()}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'tasks', filter: projectFilter },
                handleTaskChange
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'tasks', filter: projectFilter },
                handleTaskChange
            )
            .on(
                'postgres_changes',
                { event: 'DELETE', schema: 'public', table: 'tasks' },
                handleTaskChange
            )
            .subscribe((status) => {
                if (
                    status === 'CHANNEL_ERROR' ||
                    status === 'TIMED_OUT'
                ) {
                    console.error(
                        'Realtime tasks subscription error:',
                        status
                    )
                }
            })

        return () => {
            supabase.removeChannel(channel)
        }
    }, [projectId])

    // Handle task form inputs.
    function handleInputChange(e) {
        const { name, value } = e.target

        setTaskForm((previous) => ({
            ...previous,
            [name]: value,
        }))
    }

    // Create a task.
    async function handleCreateTask(e) {
        e.preventDefault()

        try {
            setSaving(true)
            setError('')

            const newTask = await createTask(projectId, taskForm)

            setTasks((previous) => {
                const withoutDuplicate = previous.filter(
                    (task) => task.id !== newTask.id
                )

                return [newTask, ...withoutDuplicate]
            })

            setTaskForm({
                title: '',
                description: '',
                priority: 'medium',
                assignee_id: '',
                due_date: '',
            })

            setShowTaskForm(false)
        } catch (err) {
            setError(err.message || 'Unable to create task.')
        } finally {
            setSaving(false)
        }
    }

    // Apply a change to a single task in local state.
    function patchTask(taskId, changes) {
        setTasks((currentTasks) =>
            currentTasks.map((task) =>
                task.id === taskId ? { ...task, ...changes } : task
            )
        )
    }

    // Save one field of a task optimistically. Several tasks can be saved
    // at the same time; if a save fails, only that task's field is rolled
    // back, so changes from other edits or from teammates are kept.
    async function saveTaskField(taskId, field, value, saveFn, errorMessage) {
        const task = tasks.find((item) => item.id === taskId)
        if (!task || updatingTaskIds.includes(taskId)) return

        const previousValue = task[field]

        setUpdatingTaskIds((ids) => [...ids, taskId])
        setError('')
        patchTask(taskId, { [field]: value })

        try {
            await saveFn(taskId, value)
        } catch (err) {
            patchTask(taskId, { [field]: previousValue })
            setError(err.message || errorMessage)
        } finally {
            setUpdatingTaskIds((ids) => ids.filter((id) => id !== taskId))
        }
    }

    // Update task status.
    function handleStatusChange(taskId, newStatus) {
        return saveTaskField(
            taskId,
            'status',
            newStatus,
            updateTaskStatus,
            'Unable to update task status.'
        )
    }

    // Assign a task to a project member.
    function handleAssigneeChange(taskId, assigneeId) {
        return saveTaskField(
            taskId,
            'assignee_id',
            assigneeId || null,
            updateTaskAssignee,
            'Unable to assign task.'
        )
    }

    // Create a project invitation.
    async function handleCreateInvitation(e) {
        e.preventDefault()

        try {
            setInvitationSaving(true)
            setError('')

            const newInvitation = await createProjectInvitation(
                projectId,
                invitationEmail
            )

            setInvitations((previous) => [
                newInvitation,
                ...previous,
            ])

            setInvitationEmail('')
        } catch (err) {
            setError(err.message || 'Unable to create invitation.')
        } finally {
            setInvitationSaving(false)
        }
    }

    // Cancel a project invitation.
    async function handleCancelInvitation(invitationId) {
        try {
            setCancellingInvitationId(invitationId)
            setError('')

            await cancelProjectInvitation(invitationId)

            setInvitations((previous) =>
                previous.filter(
                    (invitation) => invitation.id !== invitationId
                )
            )
        } catch (err) {
            setError(err.message || 'Unable to cancel invitation.')
        } finally {
            setCancellingInvitationId(null)
        }
    }

    // Transfer project ownership to an existing project member.
    async function handleTransferOwnership() {
        if (!isProjectOwner) {
            setError('Only the project owner can transfer ownership.')
            return
        }

        if (!selectedNewOwnerId) {
            setError('Please select a new owner.')
            return
        }

        const selectedMember = members.find(
            (member) => member.user_id === selectedNewOwnerId
        )

        if (!selectedMember || selectedMember.role === 'owner') {
            setError('Please select a valid project member.')
            return
        }

        const confirmed = window.confirm(
            `Transfer ownership to ${selectedMember.full_name}? You will become an admin.`
        )

        if (!confirmed) return

        try {
            setTransferringOwnership(true)
            setError('')

            await transferProjectOwnership(projectId, selectedNewOwnerId)

            const updatedMembers = await getProjectMembers(projectId)
            setMembers(updatedMembers)
            setSelectedNewOwnerId('')
        } catch (err) {
            console.error('Ownership transfer failed:', err)
            setError(err.message || 'Unable to transfer project ownership.')
        } finally {
            setTransferringOwnership(false)
        }
    }

    // Only the project owner can promote members or demote admins.
    async function handleUpdateMemberRole(member, nextRole) {
        if (!isProjectOwner) {
            setError('Only the project owner can change member roles.')
            return
        }

        if (!member || !['admin', 'member'].includes(nextRole)) {
            setError('Invalid member role change.')
            return
        }

        if (member.role === 'owner' || member.role === nextRole) return

        const action = nextRole === 'admin' ? 'promote' : 'demote'
        const confirmed = window.confirm(
            `Are you sure you want to ${action} ${member.full_name} ${nextRole === 'admin' ? 'to Admin' : 'to Member'}?`
        )
        if (!confirmed) return

        try {
            setUpdatingMemberRoleId(member.user_id)
            setError('')
            await updateProjectMemberRole(projectId, member.user_id, nextRole)
            const updatedMembers = await getProjectMembers(projectId)
            setMembers(updatedMembers)
        } catch (err) {
            console.error('Member role update failed:', err)
            setError(err.message || 'Unable to update member role.')
        } finally {
            setUpdatingMemberRoleId(null)
        }
    }

    // Remove a member according to the role permissions enforced by Supabase RLS.
    async function handleRemoveMember(member) {
        if (!member || member.role === 'owner' || member.user_id === currentUserId) return

        const canRemove = isProjectOwner
            ? ['admin', 'member'].includes(member.role)
            : isProjectAdmin && member.role === 'member'

        if (!canRemove) {
            setError('You do not have permission to remove this member.')
            return
        }

        const confirmed = window.confirm(`Remove ${member.full_name} from this project?`)
        if (!confirmed) return

        try {
            setRemovingMemberId(member.user_id)
            setError('')
            await removeProjectMember(projectId, member.user_id)
            setMembers((previous) => previous.filter((item) => item.user_id !== member.user_id))
        } catch (err) {
            console.error('Remove project member failed:', err)
            setError(err.message || 'Unable to remove this member.')
        } finally {
            setRemovingMemberId(null)
        }
    }

    // Open project settings with the current saved values.
    function handleOpenProjectSettings() {
        if (!isProjectAdmin) {
            setError('Only the project owner or an admin can edit project settings.')
            return
        }

        setProjectSettingsName(project?.name || '')
        setProjectSettingsDescription(project?.description || '')
        setError('')
        setShowProjectSettings(true)
    }

    // Save project settings. Database RLS independently enforces owner/admin access.
    async function handleSaveProjectSettings(event) {
        event.preventDefault()

        if (!isProjectAdmin) {
            setError('Only the project owner or an admin can edit project settings.')
            return
        }

        if (!projectSettingsName.trim()) {
            setError('Project name cannot be empty.')
            return
        }

        try {
            setSavingProjectSettings(true)
            setError('')

            const updatedProject = await updateProject(projectId, {
                name: projectSettingsName,
                description: projectSettingsDescription,
            })

            setProject((previous) => ({ ...previous, ...updatedProject }))
            setShowProjectSettings(false)
        } catch (err) {
            console.error('Project settings update failed:', err)
            setError(err.message || 'Unable to update project settings.')
        } finally {
            setSavingProjectSettings(false)
        }
    }

    // Only the project owner can delete the entire project.
    async function handleDeleteProject() {
        if (!isProjectOwner) {
            setError('Only the project owner can delete this project.')
            return
        }

        const projectName = project?.name || 'this project'
        const confirmed = window.confirm(
            `Permanently delete "${projectName}"? This will delete all tasks, members, invitations, notifications, and project activity. This action cannot be undone.`
        )
        if (!confirmed) return

        try {
            setDeletingProject(true)
            setError('')
            await deleteProject(projectId)
            navigate('/dashboard', {
                replace: true,
                state: { message: `Project "${projectName}" was deleted.` },
            })
        } catch (err) {
            console.error('Project deletion failed:', err)
            setError(err.message || 'Unable to delete this project.')
        } finally {
            setDeletingProject(false)
        }
    }

    // A member or admin can leave. The database policy prevents the owner from leaving.
    async function handleLeaveProject() {
        if (isProjectOwner) {
            setError('Transfer project ownership before leaving this project.')
            return
        }

        const confirmed = window.confirm('Are you sure you want to leave this project? You will lose access to its workspace.')
        if (!confirmed) return

        try {
            setLeavingProject(true)
            setError('')
            await leaveProject(projectId)
            navigate('/dashboard')
        } catch (err) {
            console.error('Leave project failed:', err)
            setError(err.message || 'Unable to leave this project.')
        } finally {
            setLeavingProject(false)
        }
    }

    // Open or close a task's comments section.
    async function handleToggleComments(taskId) {
        if (expandedTaskId === taskId) {
            setExpandedTaskId(null)
            return
        }

        setExpandedTaskId(taskId)

        if (
            Object.prototype.hasOwnProperty.call(
                commentsByTask,
                taskId
            )
        ) {
            return
        }

        try {
            setLoadingCommentsTaskId(taskId)
            setError('')

            const data = await getTaskComments(taskId)

            setCommentsByTask((previous) => ({
                ...previous,
                [taskId]: data,
            }))
        } catch (err) {
            setError(err.message || 'Unable to load comments.')
        } finally {
            setLoadingCommentsTaskId(null)
        }
    }

    // Handle comment input.
    function handleCommentInput(taskId, value) {
        setCommentDrafts((previous) => ({
            ...previous,
            [taskId]: value,
        }))
    }

    // Add a comment to a task.
    async function handleCreateComment(e, taskId) {
        e.preventDefault()

        const content = commentDrafts[taskId]?.trim()

        if (!content) {
            setError('Please enter a comment.')
            return
        }

        try {
            setSendingCommentTaskId(taskId)
            setError('')

            const newComment = await createTaskComment(
                taskId,
                projectId,
                content
            )

            setCommentsByTask((previous) => ({
                ...previous,
                [taskId]: [
                    ...(previous[taskId] || []).filter(
                        (comment) => comment.id !== newComment.id
                    ),
                    newComment,
                ],
            }))

            setCommentDrafts((previous) => ({
                ...previous,
                [taskId]: '',
            }))
        } catch (err) {
            setError(err.message || 'Unable to add comment.')
        } finally {
            setSendingCommentTaskId(null)
        }
    }

    // Delete a comment.
    async function handleDeleteComment(taskId, commentId) {
        try {
            setDeletingCommentId(commentId)
            setError('')

            await deleteTaskComment(commentId)

            setCommentsByTask((previous) => ({
                ...previous,
                [taskId]: (previous[taskId] || []).filter(
                    (comment) => comment.id !== commentId
                ),
            }))
        } catch (err) {
            setError(err.message || 'Unable to delete comment.')
        } finally {
            setDeletingCommentId(null)
        }
    }

    // Task statistics.
    const todoCount = tasks.filter(
        (task) => task.status === 'todo'
    ).length

    const progressCount = tasks.filter(
        (task) => task.status === 'in_progress'
    ).length

    const doneCount = tasks.filter(
        (task) => task.status === 'done'
    ).length

    // Apply task search, filters and sorting without changing the source list.
    const filteredTasks = [...tasks]
        .filter((task) => {
            const search = taskSearch.trim().toLowerCase()
            const title = String(task.title || '').toLowerCase()
            const description = String(task.description || '').toLowerCase()
            const matchesSearch =
                !search ||
                title.includes(search) ||
                description.includes(search)
            const matchesStatus =
                statusFilter === 'all' || task.status === statusFilter
            const matchesPriority =
                priorityFilter === 'all' || task.priority === priorityFilter
            const matchesAssignee =
                assigneeFilter === 'all' ||
                (assigneeFilter === 'unassigned'
                    ? !task.assignee_id
                    : task.assignee_id === assigneeFilter)

            return (
                matchesSearch &&
                matchesStatus &&
                matchesPriority &&
                matchesAssignee
            )
        })
        .sort((a, b) => {
            if (taskSort === 'oldest' || taskSort === 'newest') {
                const difference =
                    new Date(a.created_at || 0).getTime() -
                    new Date(b.created_at || 0).getTime()
                return taskSort === 'oldest' ? difference : -difference
            }

            if (taskSort === 'due_date') {
                if (!a.due_date && !b.due_date) return 0
                if (!a.due_date) return 1
                if (!b.due_date) return -1
                return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
            }

            const priorityRank = { high: 3, medium: 2, low: 1 }
            return (priorityRank[b.priority] || 0) - (priorityRank[a.priority] || 0)
        })

    // Build reminders from tasks due today, within the next three days, or overdue.
    // These are derived from existing task data, so no database migration is needed.
    const today = getLocalDateString()
    const taskNotifications = tasks
        .filter((task) => task.due_date && task.status !== 'done')
        .map((task) => {
            const daysUntilDue = Math.round(
                (new Date(`${task.due_date}T12:00:00`).getTime() -
                    new Date(`${today}T12:00:00`).getTime()) /
                86400000
            )

            return {
                id: `${task.id}-${task.due_date}`,
                task,
                daysUntilDue,
                type: daysUntilDue < 0 ? 'overdue' : 'upcoming',
            }
        })
        .filter((notification) => notification.daysUntilDue <= 3)
        .sort((a, b) => a.daysUntilDue - b.daysUntilDue)

    const unreadNotificationCount = taskNotifications.filter(
        (notification) => !readNotificationIds.includes(notification.id)
    ).length

    function markNotificationAsRead(notificationId) {
        setReadNotificationIds((previous) =>
            previous.includes(notificationId)
                ? previous
                : [...previous, notificationId]
        )
    }

    function markAllNotificationsAsRead() {
        setReadNotificationIds((previous) => [
            ...new Set([
                ...previous,
                ...taskNotifications.map((notification) => notification.id),
            ]),
        ])
    }

    // Find member name using user ID.
    function getMemberName(userId) {
        const member = members.find(
            (item) => item.user_id === userId
        )

        return member?.full_name || 'Unknown member'
    }

    // Activity icon.
    function getActivityIcon(type) {
        switch (type) {
            case 'project_created':
                return <ClipboardList size={18} />
            case 'task_created':
                return <ListTodo size={18} />
            case 'task_assigned':
                return <UserPlus size={18} />
            case 'task_unassigned':
                return <UserMinus size={18} />
            case 'task_status_changed':
                return <RefreshCw size={18} />
            case 'comment_added':
                return <MessageCircle size={18} />
            case 'member_invited':
                return <Mail size={18} />
            case 'member_joined':
                return <UserCheck size={18} />
            default:
                return <Activity size={18} />
        }
    }

    function getActivityColor(type) {
        switch (type) {
            case 'project_created':
                return 'bg-indigo-500/15 text-indigo-400'
            case 'task_created':
                return 'bg-blue-500/15 text-blue-400'
            case 'task_assigned':
            case 'member_invited':
                return 'bg-purple-500/15 text-purple-400'
            case 'task_unassigned':
                return 'bg-orange-500/15 text-orange-400'
            case 'task_status_changed':
                return 'bg-cyan-500/15 text-cyan-400'
            case 'comment_added':
                return 'bg-pink-500/15 text-pink-400'
            case 'member_joined':
                return 'bg-green-500/15 text-green-400'
            default:
                return 'bg-slate-700 text-slate-300'
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-300">
                Loading project...
            </div>
        )
    }

    if (!project) {
        return (
            <div className="min-h-screen bg-slate-950 p-8 text-white">
                <p>{error || 'Project not found.'}</p>

                <button
                    onClick={() => navigate('/dashboard')}
                    className="mt-4 text-indigo-400"
                >
                    Back to dashboard
                </button>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white px-6 py-8">
            <div className="max-w-5xl mx-auto">

                {/* Back button */}
                <button
                    onClick={() => navigate('/dashboard')}
                    className="flex items-center gap-2 text-slate-400 hover:text-white mb-8 transition"
                >
                    <ArrowLeft size={18} />
                    Back to dashboard
                </button>

                {/* Project header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                    <div>
                        <p className="text-sm text-indigo-400 mb-2">
                            Project workspace
                        </p>

                        <h1 className="text-3xl font-bold">
                            {project.name}
                        </h1>

                        <p className="text-slate-400 mt-2">
                            {project.description ||
                                'No project description provided.'}
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setShowNotifications((previous) => !previous)}
                                aria-label={`Task notifications${unreadNotificationCount ? `, ${unreadNotificationCount} unread` : ''}`}
                                aria-expanded={showNotifications}
                                className="relative flex h-12 w-12 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-slate-300 transition hover:border-indigo-500 hover:text-white"
                            >
                                <Bell size={20} />
                                {unreadNotificationCount > 0 && (
                                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                                        {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                                    </span>
                                )}
                            </button>

                            {showNotifications && (
                                <div className="absolute right-0 z-50 mt-3 w-96 max-w-[calc(100vw-3rem)] overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
                                    <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
                                        <div>
                                            <h3 className="font-semibold text-white">Task reminders</h3>
                                            <p className="mt-0.5 text-xs text-slate-400">Due soon and overdue tasks</p>
                                        </div>
                                        {unreadNotificationCount > 0 && (
                                            <button
                                                type="button"
                                                onClick={markAllNotificationsAsRead}
                                                className="text-xs font-medium text-indigo-400 hover:text-indigo-300"
                                            >
                                                Mark all read
                                            </button>
                                        )}
                                    </div>

                                    <div className="max-h-96 overflow-y-auto">
                                        {taskNotifications.length === 0 ? (
                                            <div className="px-5 py-8 text-center">
                                                <CheckCheck size={25} className="mx-auto mb-2 text-green-400" />
                                                <p className="text-sm font-medium text-slate-200">You're all caught up</p>
                                                <p className="mt-1 text-xs text-slate-500">No tasks are due in the next three days.</p>
                                            </div>
                                        ) : (
                                            taskNotifications.map((notification) => {
                                                const isRead = readNotificationIds.includes(notification.id)
                                                const isOverdue = notification.type === 'overdue'
                                                const dueLabel = isOverdue
                                                    ? `Overdue by ${Math.abs(notification.daysUntilDue)} ${Math.abs(notification.daysUntilDue) === 1 ? 'day' : 'days'}`
                                                    : notification.daysUntilDue === 0
                                                        ? 'Due today'
                                                        : `Due in ${notification.daysUntilDue} ${notification.daysUntilDue === 1 ? 'day' : 'days'}`

                                                return (
                                                    <button
                                                        type="button"
                                                        key={notification.id}
                                                        onClick={() => markNotificationAsRead(notification.id)}
                                                        className={`flex w-full gap-3 border-b border-slate-800 px-4 py-3 text-left transition hover:bg-slate-800/70 ${isRead ? 'opacity-65' : 'bg-slate-800/30'}`}
                                                    >
                                                        <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isOverdue ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'}`}>
                                                            {isOverdue ? <AlertCircle size={18} /> : <CalendarClock size={18} />}
                                                        </span>
                                                        <span className="min-w-0 flex-1">
                                                            <span className="block break-words text-sm font-medium text-slate-100">{notification.task.title}</span>
                                                            <span className={`mt-1 block text-xs ${isOverdue ? 'text-red-400' : 'text-amber-400'}`}>{dueLabel} · {formatDueDate(notification.task.due_date)}</span>
                                                            <span className="mt-1 block text-xs text-slate-500">{project.name}</span>
                                                        </span>
                                                        {!isRead && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-indigo-400" />}
                                                    </button>
                                                )
                                            })
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => setShowTaskForm(true)}
                            className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 px-5 py-3 rounded-xl font-medium transition"
                        >
                            <Plus size={18} />
                            Create Task
                        </button>
                    </div>
                </div>

                {/* Error message */}
                {error && (
                    <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-4 rounded-xl mb-6 flex items-start justify-between gap-3">
                        <p>{error}</p>

                        <button
                            type="button"
                            onClick={() => setError('')}
                            aria-label="Dismiss error"
                        >
                            <X size={18} />
                        </button>
                    </div>
                )}

                {/* Project settings - owners and admins can edit. */}
                <section className="mb-8 rounded-xl border border-slate-800 bg-slate-900 p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-white">Project Settings</h2>
                            <p className="mt-1 text-sm text-slate-400">Manage your project name and description.</p>
                        </div>
                        {isProjectAdmin && !showProjectSettings && (
                            <button
                                type="button"
                                onClick={handleOpenProjectSettings}
                                className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
                            >
                                Edit Settings
                            </button>
                        )}
                    </div>

                    {showProjectSettings && isProjectAdmin && (
                        <form onSubmit={handleSaveProjectSettings} className="mt-5 space-y-4 border-t border-slate-800 pt-5">
                            <div>
                                <label htmlFor="project-settings-name" className="mb-2 block text-sm font-medium text-slate-300">Project name</label>
                                <input
                                    id="project-settings-name"
                                    type="text"
                                    value={projectSettingsName}
                                    onChange={(event) => setProjectSettingsName(event.target.value)}
                                    maxLength={100}
                                    required
                                    placeholder="Enter project name"
                                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-indigo-500"
                                />
                            </div>
                            <div>
                                <label htmlFor="project-settings-description" className="mb-2 block text-sm font-medium text-slate-300">Description</label>
                                <textarea
                                    id="project-settings-description"
                                    value={projectSettingsDescription}
                                    onChange={(event) => setProjectSettingsDescription(event.target.value)}
                                    rows={4}
                                    maxLength={1000}
                                    placeholder="Describe the purpose of this project..."
                                    className="w-full resize-y rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-indigo-500"
                                />
                                <p className="mt-1 text-xs text-slate-500">Up to 1,000 characters.</p>
                            </div>
                            <div className="flex flex-wrap justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowProjectSettings(false)}
                                    disabled={savingProjectSettings}
                                    className="rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-slate-700 disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingProjectSettings || !projectSettingsName.trim()}
                                    className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {savingProjectSettings ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    )}

                    {!isProjectAdmin && (
                        <p className="mt-3 text-sm text-slate-500">Only project owners and admins can edit these settings.</p>
                    )}
                </section>

                {/* Project members */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-8">
                    <div className="flex items-center gap-3 mb-4">
                        <Users className="text-indigo-400" size={22} />

                        <h2 className="text-lg font-semibold">
                            Project Members
                        </h2>

                        <span className="text-sm text-slate-400">
                            ({members.length})
                        </span>
                    </div>

                    {members.length === 0 ? (
                        <p className="text-sm text-slate-400">
                            No project members found.
                        </p>
                    ) : (
                        <div className="flex flex-wrap gap-3">
                            {members.map((member) => (
                                <div
                                    key={member.user_id}
                                    className="flex items-center gap-3 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2"
                                >
                                    {member.avatar_url ? (
                                        <img
                                            src={member.avatar_url}
                                            alt=""
                                            className="w-9 h-9 rounded-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-9 h-9 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center">
                                            <UserRound size={18} />
                                        </div>
                                    )}

                                    <div className="min-w-0">
                                        <p className="text-sm font-medium">
                                            {member.full_name}
                                        </p>

                                        <p className="text-xs text-slate-400 capitalize">
                                            {member.role}
                                        </p>
                                    </div>

                                    {isProjectOwner && member.user_id !== currentUserId && member.role !== 'owner' && (
                                        <button
                                            type="button"
                                            onClick={() => handleUpdateMemberRole(
                                                member,
                                                member.role === 'admin' ? 'member' : 'admin'
                                            )}
                                            disabled={updatingMemberRoleId === member.user_id}
                                            className={`rounded-lg px-3 py-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${member.role === 'admin'
                                                    ? 'border border-slate-700 text-slate-300 hover:bg-slate-800'
                                                    : 'bg-indigo-600 text-white hover:bg-indigo-500'
                                                }`}
                                        >
                                            {updatingMemberRoleId === member.user_id
                                                ? 'Updating...'
                                                : member.role === 'admin'
                                                    ? 'Make Member'
                                                    : 'Make Admin'}
                                        </button>
                                    )}

                                    {member.user_id !== currentUserId && member.role !== 'owner' && (
                                        (isProjectOwner || (isProjectAdmin && member.role === 'member')) && (
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveMember(member)}
                                                disabled={removingMemberId === member.user_id}
                                                className="rounded-lg border border-red-500/30 px-3 py-2 text-xs font-medium text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                {removingMemberId === member.user_id ? 'Removing...' : 'Remove'}
                                            </button>
                                        )
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Ownership transfer - current owner only */}
                {isProjectOwner && (
                    <section className="mb-8 rounded-xl border border-amber-500/20 bg-slate-900 p-5">
                        <div className="mb-4">
                            <h3 className="font-semibold text-white">
                                Transfer Project Ownership
                            </h3>
                            <p className="mt-1 text-sm text-slate-400">
                                Choose an existing project member. After the transfer,
                                they become the owner and your role changes to admin.
                            </p>
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row">
                            <select
                                value={selectedNewOwnerId}
                                onChange={(e) => setSelectedNewOwnerId(e.target.value)}
                                disabled={transferringOwnership}
                                className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500 disabled:opacity-50"
                            >
                                <option value="">Select a new owner</option>
                                {members
                                    .filter((member) => member.user_id !== currentUserId)
                                    .map((member) => (
                                        <option
                                            key={member.user_id}
                                            value={member.user_id}
                                        >
                                            {member.full_name} ({member.role})
                                        </option>
                                    ))}
                            </select>

                            <button
                                type="button"
                                onClick={handleTransferOwnership}
                                disabled={transferringOwnership || !selectedNewOwnerId}
                                className="rounded-xl bg-amber-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {transferringOwnership ? 'Transferring...' : 'Transfer Ownership'}
                            </button>
                        </div>

                        <p className="mt-3 text-xs text-amber-400">
                            This action changes your permissions immediately.
                        </p>
                    </section>
                )}

                {/* Leave project - available to admins and members, not the owner. */}
                {!isProjectOwner && (
                    <div className="mb-8 flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900 p-5 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h3 className="font-semibold text-white">Leave Project</h3>
                            <p className="mt-1 text-sm text-slate-400">Leave this workspace and lose access to its tasks and project activity.</p>
                        </div>
                        <button
                            type="button"
                            onClick={handleLeaveProject}
                            disabled={leavingProject}
                            className="rounded-xl border border-red-500/40 px-4 py-2.5 text-sm font-medium text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {leavingProject ? 'Leaving...' : 'Leave Project'}
                        </button>
                    </div>
                )}

                {isProjectOwner && (
                    <p className="mb-8 text-sm text-slate-400">To leave this project, transfer ownership first.</p>
                )}

                {/* Delete project - current owner only. Database RLS enforces this too. */}
                {isProjectOwner && (
                    <section className="mb-8 flex flex-col gap-3 rounded-xl border border-red-500/30 bg-red-950/20 p-5 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h3 className="font-semibold text-red-200">Delete Project</h3>
                            <p className="mt-1 text-sm text-slate-400">
                                Permanently delete this project and all its related data. This cannot be undone.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={handleDeleteProject}
                            disabled={deletingProject}
                            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-red-500/50 bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <Trash2 size={16} />
                            {deletingProject ? 'Deleting...' : 'Delete Project'}
                        </button>
                    </section>
                )}

                {/* Project invitations - admins only */}
                {isProjectAdmin && (
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-8">
                        <div className="flex items-center gap-3 mb-5">
                            <Mail className="text-indigo-400" size={22} />

                            <h2 className="text-lg font-semibold">
                                Invite Members
                            </h2>
                        </div>

                        <form
                            onSubmit={handleCreateInvitation}
                            className="flex flex-col sm:flex-row gap-3"
                        >
                            <input
                                type="email"
                                value={invitationEmail}
                                onChange={(e) =>
                                    setInvitationEmail(e.target.value)
                                }
                                placeholder="Enter member's email address"
                                required
                                className="flex-1 min-w-0 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-indigo-500"
                            />

                            <button
                                type="submit"
                                disabled={invitationSaving}
                                className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-5 py-3 rounded-xl font-medium transition"
                            >
                                <Send size={17} />
                                {invitationSaving
                                    ? 'Sending...'
                                    : 'Create Invitation'}
                            </button>
                        </form>

                        <p className="text-xs text-slate-400 mt-3">
                            The invited person must sign up or log in using
                            this same email address.
                        </p>

                        <div className="border-t border-slate-800 mt-6 pt-5">
                            <h3 className="text-sm font-semibold text-slate-300 mb-4">
                                Invitations ({invitations.length})
                            </h3>

                            {invitations.length === 0 ? (
                                <p className="text-sm text-slate-500">
                                    No invitations created yet.
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    {invitations.map((invitation) => (
                                        <div
                                            key={invitation.id}
                                            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-950 border border-slate-800 rounded-xl p-4"
                                        >
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium break-all">
                                                    {invitation.invited_email}
                                                </p>

                                                <p className="text-xs text-slate-400 mt-1">
                                                    Created:{' '}
                                                    {new Date(
                                                        invitation.created_at
                                                    ).toLocaleDateString()}
                                                </p>

                                                <span
                                                    className={`inline-block mt-2 text-xs px-2.5 py-1 rounded-full capitalize ${invitation.status === 'pending'
                                                        ? 'bg-yellow-500/10 text-yellow-400'
                                                        : invitation.status === 'accepted'
                                                            ? 'bg-green-500/10 text-green-400'
                                                            : 'bg-slate-700 text-slate-300'
                                                        }`}
                                                >
                                                    {invitation.status}
                                                </span>
                                            </div>

                                            {invitation.status === 'pending' && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleCancelInvitation(
                                                            invitation.id
                                                        )
                                                    }
                                                    disabled={
                                                        cancellingInvitationId ===
                                                        invitation.id
                                                    }
                                                    className="flex items-center justify-center gap-2 text-red-400 hover:text-red-300 disabled:opacity-50 text-sm"
                                                >
                                                    <Trash2 size={16} />
                                                    {cancellingInvitationId ===
                                                        invitation.id
                                                        ? 'Cancelling...'
                                                        : 'Cancel'}
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Project Activity Feed */}
                <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-8">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                        <div className="flex items-center gap-3">
                            <Activity
                                className="text-indigo-400"
                                size={22}
                            />

                            <div>
                                <h2 className="text-lg font-semibold">
                                    Project Activity
                                </h2>

                                <p className="text-xs text-slate-400 mt-1">
                                    Stay updated with what's happening in
                                    this project.
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={refreshActivities}
                            disabled={loadingActivities}
                            className="flex items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                        >
                            {loadingActivities ? (
                                <LoaderCircle
                                    size={15}
                                    className="animate-spin"
                                />
                            ) : (
                                <RefreshCw size={15} />
                            )}
                            Refresh
                        </button>
                    </div>

                    {activityError && (
                        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                            {activityError}
                        </div>
                    )}

                    {loadingActivities ? (
                        <div className="flex items-center justify-center gap-3 py-10 text-sm text-slate-400">
                            <LoaderCircle
                                size={19}
                                className="animate-spin"
                            />
                            Loading project activity...
                        </div>
                    ) : activities.length === 0 ? (
                        <div className="py-10 text-center">
                            <Activity
                                size={34}
                                className="mx-auto mb-3 text-slate-600"
                            />

                            <h3 className="font-medium text-slate-300">
                                No activity yet
                            </h3>

                            <p className="mt-2 text-sm text-slate-500">
                                Project updates will appear here as your
                                team works.
                            </p>
                        </div>
                    ) : (
                        <div className="relative">
                            <div className="absolute left-[17px] top-5 bottom-5 w-px bg-slate-800" />

                            <div className="space-y-5">
                                {activities.map((item) => (
                                    <div
                                        key={item.id}
                                        className="relative flex gap-4"
                                    >
                                        <div
                                            className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${getActivityColor(
                                                item.activity_type
                                            )}`}
                                        >
                                            {getActivityIcon(
                                                item.activity_type
                                            )}
                                        </div>

                                        <div className="min-w-0 flex-1 rounded-xl border border-slate-800 bg-slate-950 p-4">
                                            <div className="flex flex-wrap items-center gap-2 mb-2">
                                                {item.actor_avatar ? (
                                                    <img
                                                        src={item.actor_avatar}
                                                        alt=""
                                                        className="h-6 w-6 rounded-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-slate-400">
                                                        <UserRound size={13} />
                                                    </div>
                                                )}

                                                <span className="text-sm font-medium text-slate-200">
                                                    {item.actor_name ||
                                                        'A team member'}
                                                </span>

                                                {item.actor_id ===
                                                    currentUserId && (
                                                        <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-xs text-indigo-300">
                                                            You
                                                        </span>
                                                    )}
                                            </div>

                                            <p className="text-sm leading-6 text-slate-300 break-words">
                                                {item.description}
                                            </p>

                                            {item.task_title && (
                                                <p className="mt-2 text-xs text-indigo-300">
                                                    Task: {item.task_title}
                                                </p>
                                            )}

                                            <p className="mt-3 text-xs text-slate-500">
                                                {new Date(
                                                    item.created_at
                                                ).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </section>

                {/* Task statistics */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                    <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
                        <div className="flex items-center gap-3">
                            <Circle
                                className="text-slate-400"
                                size={22}
                            />
                            <span className="text-slate-400">Todo</span>
                        </div>

                        <p className="text-3xl font-bold mt-3">
                            {todoCount}
                        </p>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
                        <div className="flex items-center gap-3">
                            <Clock3
                                className="text-blue-400"
                                size={22}
                            />
                            <span className="text-slate-400">
                                In Progress
                            </span>
                        </div>

                        <p className="text-3xl font-bold mt-3">
                            {progressCount}
                        </p>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
                        <div className="flex items-center gap-3">
                            <CheckCircle2
                                className="text-green-400"
                                size={22}
                            />
                            <span className="text-slate-400">
                                Completed
                            </span>
                        </div>

                        <p className="text-3xl font-bold mt-3">
                            {doneCount}
                        </p>
                    </div>
                </div>

                {/* Tasks heading */}
                <div className="flex items-center gap-3 mb-5">
                    <ClipboardList
                        className="text-indigo-400"
                        size={22}
                    />

                    <h2 className="text-xl font-semibold">
                        Project Tasks
                    </h2>

                    <span className="text-sm text-slate-400">
                        ({tasks.length})
                    </span>
                </div>

                {/* Switch between list and Kanban board views */}
                <div className="mb-5 flex justify-end">
                    <div className="inline-flex rounded-lg border border-slate-700 bg-slate-900 p-1">
                        <button
                            type="button"
                            onClick={() => setTaskView('list')}
                            aria-pressed={taskView === 'list'}
                            className={`rounded-md px-4 py-2 text-sm transition ${taskView === 'list'
                                ? 'bg-indigo-600 text-white'
                                : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            List View
                        </button>
                        <button
                            type="button"
                            onClick={() => setTaskView('board')}
                            aria-pressed={taskView === 'board'}
                            className={`rounded-md px-4 py-2 text-sm transition ${taskView === 'board'
                                ? 'bg-indigo-600 text-white'
                                : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            Board View
                        </button>
                    </div>
                </div>

                {/* Task search and filters */}
                <section className="mb-5 rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
                    <div className="mb-4 flex items-center gap-2 text-slate-300">
                        <SlidersHorizontal size={18} className="text-indigo-400" />
                        <h3 className="text-sm font-semibold">Find and organise tasks</h3>
                        <span className="ml-auto text-xs text-slate-500">
                            Showing {filteredTasks.length} of {tasks.length}
                        </span>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <label className="relative block sm:col-span-2 lg:col-span-1">
                            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                type="search"
                                value={taskSearch}
                                onChange={(e) => setTaskSearch(e.target.value)}
                                placeholder="Search title or description..."
                                className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2.5 pl-10 pr-3 text-sm outline-none transition placeholder:text-slate-500 focus:border-indigo-500"
                            />
                        </label>

                        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm outline-none focus:border-indigo-500">
                            <option value="all">All statuses</option>
                            <option value="todo">To Do</option>
                            <option value="in_progress">In Progress</option>
                            <option value="done">Done</option>
                        </select>

                        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm outline-none focus:border-indigo-500">
                            <option value="all">All priorities</option>
                            <option value="high">High priority</option>
                            <option value="medium">Medium priority</option>
                            <option value="low">Low priority</option>
                        </select>

                        <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm outline-none focus:border-indigo-500">
                            <option value="all">All assignees</option>
                            <option value="unassigned">Unassigned</option>
                            {members.map((member) => (
                                <option key={member.user_id} value={member.user_id}>
                                    {member.full_name || 'Unnamed member'}
                                </option>
                            ))}
                        </select>

                        <select value={taskSort} onChange={(e) => setTaskSort(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm outline-none focus:border-indigo-500">
                            <option value="newest">Newest first</option>
                            <option value="oldest">Oldest first</option>
                            <option value="due_date">Due date (soonest)</option>
                            <option value="priority">Priority (high to low)</option>
                        </select>

                        <button
                            type="button"
                            onClick={() => {
                                setTaskSearch('')
                                setStatusFilter('all')
                                setPriorityFilter('all')
                                setAssigneeFilter('all')
                                setTaskSort('newest')
                            }}
                            className="flex items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2.5 text-sm text-slate-300 transition hover:bg-slate-800"
                        >
                            <X size={15} />
                            Clear filters
                        </button>
                    </div>
                </section>

                {/* Task list or Kanban board */}
                {taskView === 'board' ? (
                    <TaskKanbanBoard
                        tasks={filteredTasks}
                        members={members}
                        onStatusChange={handleStatusChange}
                        updatingTaskIds={updatingTaskIds}
                    />
                ) : (
                    tasks.length === 0 ? (
                        <div className="border border-dashed border-slate-700 rounded-2xl p-10 text-center">
                            <ClipboardList
                                className="mx-auto text-slate-500 mb-3"
                                size={36}
                            />

                            <h3 className="text-lg font-medium">
                                No tasks yet
                            </h3>

                            <p className="text-slate-400 mt-2">
                                Create your first task to get started.
                            </p>
                        </div>
                    ) : filteredTasks.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-700 p-10 text-center">
                            <Search size={32} className="mx-auto mb-3 text-slate-500" />
                            <h3 className="font-medium text-slate-200">No matching tasks</h3>
                            <p className="mt-2 text-sm text-slate-400">Try changing your search or filters.</p>
                            <button
                                type="button"
                                onClick={() => {
                                    setTaskSearch('')
                                    setStatusFilter('all')
                                    setPriorityFilter('all')
                                    setAssigneeFilter('all')
                                    setTaskSort('newest')
                                }}
                                className="mt-4 text-sm font-medium text-indigo-400 hover:text-indigo-300"
                            >
                                Clear all filters
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredTasks.map((task) => {
                                const taskComments =
                                    commentsByTask[task.id] || []

                                const commentsOpen =
                                    expandedTaskId === task.id

                                return (
                                    <div
                                        key={task.id}
                                        className="bg-slate-900 border border-slate-800 rounded-xl p-5"
                                    >
                                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                                            <div className="min-w-0">
                                                <h3 className="font-semibold">
                                                    {task.title}
                                                </h3>

                                                {task.description && (
                                                    <p className="text-sm text-slate-400 mt-1">
                                                        {task.description}
                                                    </p>
                                                )}

                                                <span className={`inline-block mt-3 text-xs px-3 py-1 rounded-full capitalize ${getPriorityBadgeClasses(task.priority)}`}>
                                                    {task.priority || 'medium'} priority
                                                </span>

                                                {task.due_date && (
                                                    <p className={`mt-3 flex items-center gap-2 text-xs ${isTaskOverdue(task)
                                                        ? 'text-red-400'
                                                        : task.status === 'done'
                                                            ? 'text-green-400'
                                                            : 'text-slate-400'
                                                        }`}>
                                                        <Clock3 size={14} />
                                                        {isTaskOverdue(task)
                                                            ? `Overdue · ${formatDueDate(task.due_date)}`
                                                            : `Due ${formatDueDate(task.due_date)}`}
                                                    </p>
                                                )}

                                                <p className="text-xs text-slate-400 mt-3">
                                                    Assigned to:{' '}
                                                    {task.assignee_id
                                                        ? getMemberName(
                                                            task.assignee_id
                                                        )
                                                        : 'Unassigned'}
                                                </p>
                                            </div>

                                            <div className="flex flex-col sm:flex-row gap-3">
                                                <select
                                                    value={task.status}
                                                    disabled={
                                                        updatingTaskIds.includes(task.id)
                                                    }
                                                    onChange={(e) =>
                                                        handleStatusChange(
                                                            task.id,
                                                            e.target.value
                                                        )
                                                    }
                                                    className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 disabled:opacity-50"
                                                >
                                                    <option value="todo">
                                                        Todo
                                                    </option>
                                                    <option value="in_progress">
                                                        In Progress
                                                    </option>
                                                    <option value="done">
                                                        Done
                                                    </option>
                                                </select>

                                                <select
                                                    value={task.assignee_id || ''}
                                                    disabled={
                                                        updatingTaskIds.includes(task.id)
                                                    }
                                                    onChange={(e) =>
                                                        handleAssigneeChange(
                                                            task.id,
                                                            e.target.value
                                                        )
                                                    }
                                                    className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 disabled:opacity-50"
                                                >
                                                    <option value="">
                                                        Unassigned
                                                    </option>

                                                    {members.map((member) => (
                                                        <option
                                                            key={member.user_id}
                                                            value={member.user_id}
                                                        >
                                                            {member.full_name}
                                                        </option>
                                                    ))}
                                                </select>

                                                {updatingTaskIds.includes(task.id) && (
                                                    <span className="text-xs text-slate-400 self-center">
                                                        Saving...
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Comments */}
                                        <div className="mt-5 border-t border-slate-800 pt-4">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    handleToggleComments(task.id)
                                                }
                                                className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition"
                                            >
                                                <MessageCircle size={17} />

                                                {commentsOpen
                                                    ? 'Hide comments'
                                                    : 'View comments'}

                                                {Object.prototype.hasOwnProperty.call(
                                                    commentsByTask,
                                                    task.id
                                                ) && (
                                                        <span className="text-slate-400">
                                                            ({taskComments.length})
                                                        </span>
                                                    )}
                                            </button>

                                            {commentsOpen && (
                                                <div className="mt-5 space-y-5">
                                                    {loadingCommentsTaskId ===
                                                        task.id ? (
                                                        <p className="text-sm text-slate-400">
                                                            Loading comments...
                                                        </p>
                                                    ) : (
                                                        <>
                                                            {taskComments.length ===
                                                                0 ? (
                                                                <p className="text-sm text-slate-500">
                                                                    No comments yet.
                                                                    Start the
                                                                    discussion.
                                                                </p>
                                                            ) : (
                                                                <div className="space-y-4">
                                                                    {taskComments.map(
                                                                        (comment) => (
                                                                            <div
                                                                                key={
                                                                                    comment.id
                                                                                }
                                                                                className="flex items-start gap-3"
                                                                            >
                                                                                {comment.author_avatar ? (
                                                                                    <img
                                                                                        src={
                                                                                            comment.author_avatar
                                                                                        }
                                                                                        alt=""
                                                                                        className="w-9 h-9 rounded-full object-cover shrink-0"
                                                                                    />
                                                                                ) : (
                                                                                    <div className="w-9 h-9 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center shrink-0">
                                                                                        <UserRound
                                                                                            size={
                                                                                                17
                                                                                            }
                                                                                        />
                                                                                    </div>
                                                                                )}

                                                                                <div className="flex-1 min-w-0 bg-slate-950 border border-slate-800 rounded-xl p-3">
                                                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                                                        <p className="text-sm font-medium">
                                                                                            {
                                                                                                comment.author_name
                                                                                            }
                                                                                        </p>

                                                                                        <span className="text-xs text-slate-500">
                                                                                            {new Date(
                                                                                                comment.created_at
                                                                                            ).toLocaleString()}
                                                                                        </span>
                                                                                    </div>

                                                                                    <p className="text-sm text-slate-300 mt-2 whitespace-pre-wrap break-words">
                                                                                        {
                                                                                            comment.content
                                                                                        }
                                                                                    </p>

                                                                                    {(comment.author_id ===
                                                                                        currentUserId ||
                                                                                        isProjectAdmin) && (
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() =>
                                                                                                    handleDeleteComment(
                                                                                                        task.id,
                                                                                                        comment.id
                                                                                                    )
                                                                                                }
                                                                                                disabled={
                                                                                                    deletingCommentId ===
                                                                                                    comment.id
                                                                                                }
                                                                                                className="mt-3 flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                                                                                            >
                                                                                                <Trash2
                                                                                                    size={
                                                                                                        13
                                                                                                    }
                                                                                                />

                                                                                                {deletingCommentId ===
                                                                                                    comment.id
                                                                                                    ? 'Deleting...'
                                                                                                    : 'Delete'}
                                                                                            </button>
                                                                                        )}
                                                                                </div>
                                                                            </div>
                                                                        )
                                                                    )}
                                                                </div>
                                                            )}

                                                            <form
                                                                onSubmit={(e) =>
                                                                    handleCreateComment(
                                                                        e,
                                                                        task.id
                                                                    )
                                                                }
                                                                className="flex flex-col sm:flex-row gap-3"
                                                            >
                                                                <textarea
                                                                    value={
                                                                        commentDrafts[
                                                                        task.id
                                                                        ] || ''
                                                                    }
                                                                    onChange={(e) =>
                                                                        handleCommentInput(
                                                                            task.id,
                                                                            e.target
                                                                                .value
                                                                        )
                                                                    }
                                                                    placeholder="Write a comment..."
                                                                    rows={2}
                                                                    maxLength={2000}
                                                                    required
                                                                    className="flex-1 min-w-0 resize-none bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-500"
                                                                />

                                                                <button
                                                                    type="submit"
                                                                    disabled={
                                                                        sendingCommentTaskId ===
                                                                        task.id ||
                                                                        !commentDrafts[
                                                                            task.id
                                                                        ]?.trim()
                                                                    }
                                                                    className="flex items-center justify-center gap-2 self-end sm:self-stretch bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed px-5 py-3 rounded-xl text-sm font-medium transition"
                                                                >
                                                                    <Send size={16} />

                                                                    {sendingCommentTaskId ===
                                                                        task.id
                                                                        ? 'Posting...'
                                                                        : 'Post'}
                                                                </button>
                                                            </form>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )
                )}

                {/* Create task modal */}
                {showTaskForm && (
                    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
                        <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-semibold">
                                    Create a new task
                                </h2>

                                <button
                                    type="button"
                                    onClick={() => setShowTaskForm(false)}
                                    className="text-slate-400 hover:text-white"
                                    aria-label="Close form"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <form
                                onSubmit={handleCreateTask}
                                className="space-y-4"
                            >
                                <div>
                                    <label className="block text-sm text-slate-300 mb-2">
                                        Task title
                                    </label>

                                    <input
                                        type="text"
                                        name="title"
                                        value={taskForm.title}
                                        onChange={handleInputChange}
                                        placeholder="e.g. Design the login page"
                                        required
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-indigo-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm text-slate-300 mb-2">
                                        Description
                                    </label>

                                    <textarea
                                        name="description"
                                        value={taskForm.description}
                                        onChange={handleInputChange}
                                        placeholder="Describe what needs to be done..."
                                        rows={3}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 resize-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm text-slate-300 mb-2">
                                        Priority
                                    </label>

                                    <select
                                        name="priority"
                                        value={taskForm.priority}
                                        onChange={handleInputChange}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-indigo-500"
                                    >
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm text-slate-300 mb-2">
                                        Assign to
                                    </label>

                                    <select
                                        name="assignee_id"
                                        value={taskForm.assignee_id}
                                        onChange={handleInputChange}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-indigo-500"
                                    >
                                        <option value="">Unassigned</option>

                                        {members.map((member) => (
                                            <option
                                                key={member.user_id}
                                                value={member.user_id}
                                            >
                                                {member.full_name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm text-slate-300 mb-2">
                                        Due date (optional)
                                    </label>
                                    <input
                                        type="date"
                                        name="due_date"
                                        value={taskForm.due_date || ''}
                                        onChange={handleInputChange}
                                        min={getLocalDateString()}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 outline-none focus:border-indigo-500"
                                    />
                                    <p className="mt-2 text-xs text-slate-500">
                                        Choose the date by which this task should be completed.
                                    </p>
                                </div>

                                <div className="flex justify-end gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowTaskForm(false)}
                                        className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700"
                                    >
                                        Cancel
                                    </button>

                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50"
                                    >
                                        {saving
                                            ? 'Creating...'
                                            : 'Create Task'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default ProjectDetails
