
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
    UserRound,
    Send,
    Trash2,
    MessageCircle,
    Search,
    SlidersHorizontal,
} from 'lucide-react'

import { supabase } from '../lib/supabase'
import { getCurrentUser } from '../lib/auth'

import {
    getTasks,
    createTask,
    updateTaskStatus,
    updateTaskAssignee,
} from '../lib/taskService'

import { getProjectMembers } from '../lib/projectMemberService'
import { getProjectInvitations } from '../lib/invitationService'

import {
    getTaskComments,
    createTaskComment,
    deleteTaskComment,
} from '../lib/commentService'

import { getProjectActivities } from '../lib/activityService'

import TaskKanbanBoard from '../components/project/TaskKanbanBoard'
import TaskReminders from '../components/project/TaskReminders'
import ProjectActivityFeed from '../components/project/ProjectActivityFeed'
import ProjectSettingsPanel from '../components/project/ProjectSettingsPanel'
import ProjectMembersPanel from '../components/project/ProjectMembersPanel'
import OwnershipTransferPanel from '../components/project/OwnershipTransferPanel'
import ProjectDangerZone from '../components/project/ProjectDangerZone'
import InvitationsPanel from '../components/project/InvitationsPanel'
import {
    formatDueDate,
    getLocalDateString,
    getPriorityBadgeClasses,
    isTaskOverdue,
} from '../components/project/taskUtils'

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
    // Task search, filters and sorting.
    const [taskSearch, setTaskSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [priorityFilter, setPriorityFilter] = useState('all')
    const [assigneeFilter, setAssigneeFilter] = useState('all')
    const [taskSort, setTaskSort] = useState('newest')
    const [taskView, setTaskView] = useState('list')

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

    // Find member name using user ID.
    function getMemberName(userId) {
        const member = members.find(
            (item) => item.user_id === userId
        )

        return member?.full_name || 'Unknown member'
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
                        <TaskReminders
                            projectId={projectId}
                            projectName={project.name}
                            tasks={tasks}
                            tasksLoaded={!loading}
                        />

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

                <ProjectSettingsPanel
                    project={project}
                    projectId={projectId}
                    isProjectAdmin={isProjectAdmin}
                    onProjectChange={setProject}
                    onError={setError}
                />

                <ProjectMembersPanel
                    projectId={projectId}
                    members={members}
                    currentUserId={currentUserId}
                    isProjectOwner={isProjectOwner}
                    isProjectAdmin={isProjectAdmin}
                    onMembersChange={setMembers}
                    onError={setError}
                />

                {isProjectOwner && (
                    <OwnershipTransferPanel
                        projectId={projectId}
                        members={members}
                        currentUserId={currentUserId}
                        isProjectOwner={isProjectOwner}
                        onMembersChange={setMembers}
                        onError={setError}
                    />
                )}

                <ProjectDangerZone
                    project={project}
                    projectId={projectId}
                    isProjectOwner={isProjectOwner}
                    onError={setError}
                />

                {isProjectAdmin && (
                    <InvitationsPanel
                        projectId={projectId}
                        invitations={invitations}
                        onInvitationsChange={setInvitations}
                        onError={setError}
                    />
                )}

                <ProjectActivityFeed
                    activities={activities}
                    loading={loadingActivities}
                    error={activityError}
                    onRefresh={refreshActivities}
                    currentUserId={currentUserId}
                />

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
