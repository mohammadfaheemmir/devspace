
import { useCallback, useEffect, useRef, useState } from 'react'
import { getErrorMessage } from '../lib/errors'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import type { Tables } from '../types/database'
import type { Project, ProjectLabel, ProjectMember, Task } from '../types/app'
import type { ProjectInvitation } from '../lib/invitationService'
import type { ProjectActivity } from '../lib/activityService'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
    ArrowLeft,
    Plus,
    ClipboardList,
    CheckCircle2,
    Clock3,
    Circle,
    Search,
} from 'lucide-react'

import { supabase } from '../lib/supabase'
import { getCurrentUser } from '../lib/auth'

import {
    getTasks,
    updateTaskStatus,
    updateTaskAssignee,
} from '../lib/taskService'

import { getProjectMembers } from '../lib/projectMemberService'
import { getProjectInvitations } from '../lib/invitationService'

import { getProjectActivities } from '../lib/activityService'
import { getProjectLabels, getTaskLabelLinks, groupLabelIdsByTask } from '../lib/labelService'
import { useTaskComments } from '../hooks/useTaskComments'
import { useToast } from '../context/useToast'

import TaskKanbanBoard from '../components/project/TaskKanbanBoard'
import TaskCalendar from '../components/project/TaskCalendar'
import TaskReminders from '../components/project/TaskReminders'
import ProjectActivityFeed from '../components/project/ProjectActivityFeed'
import ProjectSettingsPanel from '../components/project/ProjectSettingsPanel'
import LabelManager from '../components/project/LabelManager'
import ProjectMembersPanel from '../components/project/ProjectMembersPanel'
import OwnershipTransferPanel from '../components/project/OwnershipTransferPanel'
import ProjectDangerZone from '../components/project/ProjectDangerZone'
import InvitationsPanel from '../components/project/InvitationsPanel'
import TaskFilters from '../components/project/TaskFilters'
import TaskListItem from '../components/project/TaskListItem'
import TaskFormModal from '../components/project/TaskFormModal'
import {
    DEFAULT_TASK_FILTERS,
    filterAndSortTasks,
} from '../components/project/taskUtils'

type TaskView = 'list' | 'board' | 'calendar'

type ProjectTab = 'tasks' | 'activity' | 'team' | 'settings'

const PROJECT_TABS: { id: ProjectTab; label: string }[] = [
    { id: 'tasks', label: 'Tasks' },
    { id: 'activity', label: 'Activity' },
    { id: 'team', label: 'Team' },
    { id: 'settings', label: 'Settings' },
]

function isProjectTab(value: string | null): value is ProjectTab {
    return PROJECT_TABS.some((tab) => tab.id === value)
}

const TASK_VIEWS: { id: TaskView; label: string }[] = [
    { id: 'list', label: 'List View' },
    { id: 'board', label: 'Board View' },
    { id: 'calendar', label: 'Calendar' },
]

// projectId comes from the route (see App.tsx), which only renders this page
// when the URL contains one.
function ProjectDetails({ projectId }: { projectId: string }) {
    const navigate = useNavigate()

    const [project, setProject] = useState<Project | null>(null)
    const [tasks, setTasks] = useState<Task[]>([])
    const [members, setMembers] = useState<ProjectMember[]>([])
    const [invitations, setInvitations] = useState<ProjectInvitation[]>([])
    const [activities, setActivities] = useState<ProjectActivity[]>([])
    const [currentUserId, setCurrentUserId] = useState<string | null>(null)

    const [loading, setLoading] = useState(true)
    const [loadingActivities, setLoadingActivities] = useState(true)
    const [activityError, setActivityError] = useState('')
    const [error, setError] = useState('')

    const [showTaskForm, setShowTaskForm] = useState(false)
    const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
    const [updatingTaskIds, setUpdatingTaskIds] = useState<string[]>([])

    // Labels: the project's labels and { taskId: [labelId, ...] }.
    const [labels, setLabels] = useState<ProjectLabel[]>([])
    const [labelIdsByTask, setLabelIdsByTask] = useState<Record<string, string[]>>({})

    // Latest state for the Realtime handlers below (they are created once
    // per project, so they read current values through refs).
    const labelsRef = useRef(labels)
    const labelIdsByTaskRef = useRef(labelIdsByTask)
    const membersRef = useRef(members)
    const currentUserIdRef = useRef(currentUserId)
    useEffect(() => {
        labelsRef.current = labels
        labelIdsByTaskRef.current = labelIdsByTask
        membersRef.current = members
        currentUserIdRef.current = currentUserId
    }, [labels, labelIdsByTask, members, currentUserId])
    const [taskView, setTaskView] = useState<TaskView>('list')

    // Current section tab, kept in the URL (?tab=team) for refreshes and links.
    const [searchParams, setSearchParams] = useSearchParams()
    const tabParam = searchParams.get('tab')
    const activeTab: ProjectTab = isProjectTab(tabParam) ? tabParam : 'tasks'

    function selectTab(tab: ProjectTab) {
        setSearchParams(tab === 'tasks' ? {} : { tab }, { replace: true })
    }

    // Task search, filters and sorting.
    const [filters, setFilters] = useState(DEFAULT_TASK_FILTERS)

    // Comments for all tasks (state, handlers and realtime sync).
    // Action errors appear as pop-up notices. Empty messages (used by
    // panels to clear a previous error) are ignored.
    const toast = useToast()
    const notifyError = useCallback((message: string) => {
        if (message) toast.error(message)
    }, [toast])

    const comments = useTaskComments(projectId, notifyError)
    const { forgetTask } = comments

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

                // maybeSingle: a project the user cannot see (deleted, or not a
                // member) comes back as null instead of a cryptic database error.
                const { data: projectData, error: projectError } =
                    await supabase
                        .from('projects')
                        .select('*')
                        .eq('id', projectId)
                        .maybeSingle()

                if (projectError) throw projectError
                if (!projectData) {
                    throw new Error("Project not found. It may have been deleted, or you don't have access to it.")
                }

                // Load essential workspace data first.
                const [taskData, memberData] = await Promise.all([
                    getTasks(projectId),
                    getProjectMembers(projectId),
                ])

                const currentMember = memberData.find(
                    (member) => member.user_id === user.id
                )

                let invitationData: ProjectInvitation[] = []

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

                // Labels are optional extras: a failure must not break the workspace.
                try {
                    const [labelData, linkData] = await Promise.all([
                        getProjectLabels(projectId),
                        getTaskLabelLinks(projectId),
                    ])
                    if (!active) return
                    setLabels(labelData)
                    setLabelIdsByTask(groupLabelIdsByTask(linkData))
                } catch (labelErr) {
                    console.error('Loading labels failed:', labelErr)
                }

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
                        getErrorMessage(activityErr, 'Unable to load project activities.')
                    )
                }
            } catch (err) {
                if (active) {
                    setError(getErrorMessage(err, 'Unable to load project.'))
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
                getErrorMessage(err, 'Unable to refresh project activities.')
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
                            getErrorMessage(err, 'Unable to refresh project activities.')
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

    // Real-time subscription for project members: joins, removals and role
    // changes show up without refreshing (assignee lists, admin controls).
    useEffect(() => {
        let active = true

        async function refreshMembers() {
            try {
                const memberData = await getProjectMembers(projectId)
                if (!active) return

                const me = currentUserIdRef.current
                const myMembership = memberData.find((member) => member.user_id === me)

                // Removed from the project: the page no longer works for them.
                if (me && !myMembership) {
                    navigate('/dashboard', {
                        replace: true,
                        state: { message: 'You no longer have access to that project.' },
                    })
                    return
                }

                setMembers(memberData)

                // A newly promoted admin needs the invitations list too.
                if (myMembership && ['owner', 'admin'].includes(myMembership.role)) {
                    const invitationData = await getProjectInvitations(projectId)
                    if (active) setInvitations(invitationData)
                }
            } catch (err) {
                console.error('Unable to refresh members:', err)
            }
        }

        // DELETE events are unfiltered and not covered by RLS (see the labels
        // subscription); react only to this project's membership rows.
        function onMemberDeleted(payload: { old: { id?: string } }) {
            if (membersRef.current.some((member) => member.id === payload.old.id)) refreshMembers()
        }

        const projectFilter = `project_id=eq.${projectId}`
        const channel = supabase
            .channel(`project-members-${projectId}-${crypto.randomUUID()}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'project_members', filter: projectFilter }, refreshMembers)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'project_members', filter: projectFilter }, refreshMembers)
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'project_members' }, onMemberDeleted)
            .subscribe((status) => {
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    console.error('Realtime members subscription error:', status)
                }
            })

        return () => {
            active = false
            supabase.removeChannel(channel)
        }
    }, [projectId, navigate])

    // Real-time subscription for labels: refetch on any change, so teammates
    // see new, deleted and re-assigned labels without refreshing.
    useEffect(() => {
        let active = true
        const projectFilter = `project_id=eq.${projectId}`

        async function refreshLabels() {
            try {
                const [labelData, linkData] = await Promise.all([
                    getProjectLabels(projectId),
                    getTaskLabelLinks(projectId),
                ])
                if (!active) return
                setLabels(labelData)
                setLabelIdsByTask(groupLabelIdsByTask(linkData))
            } catch (err) {
                console.error('Unable to refresh labels:', err)
            }
        }

        // DELETE events cannot be filtered by column, and Supabase does not
        // apply RLS to them, so deletes from every project arrive here (only
        // their IDs). Refresh only for deletes that concern this project.
        function onLabelDeleted(payload: { old: { id?: string } }) {
            if (labelsRef.current.some((label) => label.id === payload.old.id)) refreshLabels()
        }
        function onTaskLabelDeleted(payload: { old: { task_id?: string; label_id?: string } }) {
            const { task_id: taskId, label_id: labelId } = payload.old
            if (taskId && labelId && labelIdsByTaskRef.current[taskId]?.includes(labelId)) refreshLabels()
        }

        const channel = supabase
            .channel(`project-labels-${projectId}-${crypto.randomUUID()}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'project_labels', filter: projectFilter }, refreshLabels)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'project_labels', filter: projectFilter }, refreshLabels)
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'project_labels' }, onLabelDeleted)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'task_labels', filter: projectFilter }, refreshLabels)
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'task_labels' }, onTaskLabelDeleted)
            .subscribe((status) => {
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    console.error('Realtime labels subscription error:', status)
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

        const handleTaskChange = (payload: RealtimePostgresChangesPayload<Tables<'tasks'>>) => {
            if (payload.eventType === 'INSERT') {
                const newTask = payload.new as Task

                if (newTask.project_id !== projectId) return

                setTasks((previous) => {
                    const withoutDuplicate = previous.filter(
                        (task) => task.id !== newTask.id
                    )

                    return [newTask, ...withoutDuplicate].sort(
                        (a, b) =>
                            new Date(b.created_at ?? 0).getTime() -
                            new Date(a.created_at ?? 0).getTime()
                    )
                })
            }

            if (payload.eventType === 'UPDATE') {
                const updatedTask = payload.new as Task

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

                // Also drop any loaded comments for the deleted task.
                forgetTask(deletedTaskId)
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
    }, [projectId, forgetTask])

    // Add a newly created task to the list (Realtime may deliver it too).
    function handleTaskCreated(newTask: Task) {
        setTasks((previous) => [
            newTask,
            ...previous.filter((task) => task.id !== newTask.id),
        ])
    }

    // Replace a task with the saved version after editing.
    function handleTaskSaved(savedTask: Task) {
        patchTask(savedTask.id, savedTask)
    }

    // Remove a deleted task and anything loaded for it.
    function handleTaskDeleted(taskId: string) {
        setTasks((previous) => previous.filter((task) => task.id !== taskId))
        setLabelIdsByTask(({ [taskId]: _removed, ...rest }) => rest)
        forgetTask(taskId)
    }

    // Record a task's labels after the task form saved them.
    function handleLabelsSaved(taskId: string, labelIds: string[]) {
        setLabelIdsByTask((previous) => ({ ...previous, [taskId]: labelIds }))
    }

    // After labels are created or deleted; clear the filter if its label is gone.
    function handleLabelsChange(nextLabels: ProjectLabel[]) {
        setLabels(nextLabels)
        setFilters((current) =>
            current.label !== 'all' && !nextLabels.some((label) => label.id === current.label)
                ? { ...current, label: 'all' }
                : current
        )
    }

    // Task creators and project owners/admins may delete a task.
    // (The database's Row Level Security has the final say.)
    function canDeleteTask(task: Task) {
        return isProjectAdmin || task.created_by === currentUserId
    }

    // Apply a change to a single task in local state.
    function patchTask(taskId: string, changes: Partial<Task>) {
        setTasks((currentTasks) =>
            currentTasks.map((task) =>
                task.id === taskId ? { ...task, ...changes } : task
            )
        )
    }

    // Save one field of a task optimistically. Several tasks can be saved
    // at the same time; if a save fails, only that task's field is rolled
    // back, so changes from other edits or from teammates are kept.
    async function saveTaskField<V extends string | null>(
        taskId: string,
        field: 'status' | 'assignee_id',
        value: V,
        saveFn: (taskId: string, value: V) => Promise<unknown>,
        errorMessage: string
    ) {
        const task = tasks.find((item) => item.id === taskId)
        if (!task || updatingTaskIds.includes(taskId)) return

        const previousValue = task[field]

        setUpdatingTaskIds((ids) => [...ids, taskId])
        patchTask(taskId, { [field]: value } as Partial<Task>)

        try {
            await saveFn(taskId, value)
        } catch (err) {
            patchTask(taskId, { [field]: previousValue } as Partial<Task>)
            notifyError(getErrorMessage(err, errorMessage))
        } finally {
            setUpdatingTaskIds((ids) => ids.filter((id) => id !== taskId))
        }
    }

    // Update task status.
    function handleStatusChange(taskId: string, newStatus: string) {
        return saveTaskField(
            taskId,
            'status',
            newStatus,
            updateTaskStatus,
            'Unable to update task status.'
        )
    }

    // Assign a task to a project member.
    function handleAssigneeChange(taskId: string, assigneeId: string) {
        return saveTaskField(
            taskId,
            'assignee_id',
            assigneeId || null,
            updateTaskAssignee,
            'Unable to assign task.'
        )
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

    const completionPercent = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0

    const filteredTasks = filterAndSortTasks(tasks, filters, labelIdsByTask)
    const editingTask = tasks.find((task) => task.id === editingTaskId) || null

    function resetFilters() {
        setFilters(DEFAULT_TASK_FILTERS)
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center text-slate-300">
                Loading project...
            </div>
        )
    }

    if (!project) {
        return (
            <div className="min-h-screen p-8 text-white">
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
        <div className="min-h-screen text-white px-4 py-8 sm:px-6">
            <div className="max-w-5xl mx-auto">

                {/* Back link */}
                <button
                    onClick={() => navigate('/dashboard')}
                    className="mb-6 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
                >
                    <ArrowLeft size={16} />
                    Back to dashboard
                </button>

                {/* Project header with progress at a glance */}
                <header className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl shadow-black/20 backdrop-blur sm:p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-indigo-300">
                                Project workspace
                            </p>
                            <h1 className="break-words text-2xl font-bold tracking-tight sm:text-3xl">
                                {project.name}
                            </h1>
                            <p className="mt-2 max-w-2xl break-words text-sm text-slate-400 sm:text-base">
                                {project.description || 'No project description provided.'}
                            </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-3">
                            <TaskReminders
                                projectId={projectId}
                                projectName={project.name}
                                tasks={tasks}
                                tasksLoaded={!loading}
                            />

                            <button
                                onClick={() => setShowTaskForm(true)}
                                className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-medium shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500"
                            >
                                <Plus size={18} />
                                Create Task
                            </button>
                        </div>
                    </div>

                    <div className="mt-5 flex flex-col gap-4 border-t border-slate-800 pt-5 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0 flex-1 md:max-w-md">
                            <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                                <span className="flex items-center gap-1.5 text-slate-300"><Circle size={14} className="text-slate-400" />{todoCount} to do</span>
                                <span className="flex items-center gap-1.5 text-slate-300"><Clock3 size={14} className="text-yellow-400" />{progressCount} in progress</span>
                                <span className="flex items-center gap-1.5 text-slate-300"><CheckCircle2 size={14} className="text-green-400" />{doneCount} done</span>
                            </div>
                            <div
                                className="h-2 overflow-hidden rounded-full bg-slate-800"
                                role="progressbar"
                                aria-label="Tasks completed"
                                aria-valuenow={completionPercent}
                                aria-valuemin={0}
                                aria-valuemax={100}
                            >
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-green-500 transition-all"
                                    style={{ width: `${completionPercent}%` }}
                                />
                            </div>
                            <p className="mt-1.5 text-xs text-slate-400">{completionPercent}% complete</p>
                        </div>

                        <button
                            type="button"
                            onClick={() => selectTab('team')}
                            className="flex items-center gap-3 self-start rounded-xl px-2 py-1 text-left transition hover:bg-slate-800/60 md:self-auto"
                            aria-label={`Team: ${members.length} ${members.length === 1 ? 'member' : 'members'}`}
                        >
                            <span className="flex -space-x-2">
                                {members.slice(0, 5).map((member) => (
                                    <span
                                        key={member.user_id}
                                        title={member.full_name}
                                        className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-slate-900 bg-indigo-500/80 text-xs font-semibold text-white"
                                    >
                                        {member.full_name.charAt(0).toUpperCase()}
                                    </span>
                                ))}
                            </span>
                            <span className="text-sm text-slate-400">
                                {members.length} {members.length === 1 ? 'member' : 'members'}
                            </span>
                        </button>
                    </div>
                </header>

                {/* Sections as tabs, so tasks are not buried under admin panels */}
                <div
                    role="tablist"
                    aria-label="Project sections"
                    className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60 p-1"
                >
                    {PROJECT_TABS.map((tab) => {
                        const selected = activeTab === tab.id
                        const count = tab.id === 'tasks' ? tasks.length : tab.id === 'team' ? members.length : null
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                role="tab"
                                id={`tab-${tab.id}`}
                                aria-selected={selected}
                                aria-controls={`panel-${tab.id}`}
                                aria-label={count !== null ? `${tab.label} (${count})` : undefined}
                                onClick={() => selectTab(tab.id)}
                                className={`flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${selected
                                    ? 'bg-indigo-600 text-white shadow'
                                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                    }`}
                            >
                                {tab.label}
                                {count !== null && (
                                    <span className={`rounded-full px-1.5 text-xs ${selected ? 'bg-white/20' : 'bg-slate-800 text-slate-300'}`}>
                                        {count}
                                    </span>
                                )}
                            </button>
                        )
                    })}
                </div>

                {activeTab === 'activity' && (
                    <section role="tabpanel" id="panel-activity" aria-labelledby="tab-activity">
                        <ProjectActivityFeed
                            activities={activities}
                            loading={loadingActivities}
                            error={activityError}
                            onRefresh={refreshActivities}
                            currentUserId={currentUserId}
                        />
                    </section>
                )}

                {activeTab === 'team' && (
                    <section role="tabpanel" id="panel-team" aria-labelledby="tab-team">
                        <ProjectMembersPanel
                            projectId={projectId}
                            members={members}
                            currentUserId={currentUserId}
                            isProjectOwner={isProjectOwner}
                            isProjectAdmin={isProjectAdmin}
                            onMembersChange={setMembers}
                            onError={notifyError}
                        />

                        {isProjectAdmin && (
                            <InvitationsPanel
                                projectId={projectId}
                                invitations={invitations}
                                onInvitationsChange={setInvitations}
                                onError={notifyError}
                            />
                        )}

                        {isProjectOwner && (
                            <OwnershipTransferPanel
                                projectId={projectId}
                                members={members}
                                currentUserId={currentUserId}
                                isProjectOwner={isProjectOwner}
                                onMembersChange={setMembers}
                                onError={notifyError}
                            />
                        )}
                    </section>
                )}

                {activeTab === 'settings' && (
                    <section role="tabpanel" id="panel-settings" aria-labelledby="tab-settings">
                        <ProjectSettingsPanel
                            project={project}
                            projectId={projectId}
                            isProjectAdmin={isProjectAdmin}
                            onProjectChange={setProject}
                            onError={notifyError}
                        />

                        {isProjectAdmin && (
                            <LabelManager
                                projectId={projectId}
                                labels={labels}
                                onLabelsChange={handleLabelsChange}
                                onError={notifyError}
                            />
                        )}

                        <ProjectDangerZone
                            project={project}
                            projectId={projectId}
                            isProjectOwner={isProjectOwner}
                            onError={notifyError}
                        />
                    </section>
                )}

                {activeTab === 'tasks' && (
                <section role="tabpanel" id="panel-tasks" aria-labelledby="tab-tasks">
                {/* Switch between list, Kanban board and calendar views */}
                <div className="mb-4 flex justify-end">
                    <div className="inline-flex rounded-lg border border-slate-700 bg-slate-900 p-1" role="group" aria-label="Task view">
                        {TASK_VIEWS.map((view) => (
                            <button
                                key={view.id}
                                type="button"
                                onClick={() => setTaskView(view.id)}
                                aria-pressed={taskView === view.id}
                                className={`rounded-md px-3 py-2 text-sm transition sm:px-4 ${taskView === view.id
                                    ? 'bg-indigo-600 text-white'
                                    : 'text-slate-400 hover:text-white'
                                    }`}
                            >
                                {view.label}
                            </button>
                        ))}
                    </div>
                </div>

                <TaskFilters
                    filters={filters}
                    onChange={setFilters}
                    onReset={resetFilters}
                    members={members}
                    shownCount={filteredTasks.length}
                    totalCount={tasks.length}
                    labels={labels}
                />

                {/* Task list or Kanban board */}
                {taskView === 'calendar' ? (
                    <TaskCalendar
                        tasks={filteredTasks}
                        onEdit={(task) => setEditingTaskId(task.id)}
                    />
                ) : taskView === 'board' ? (
                    <TaskKanbanBoard
                        tasks={filteredTasks}
                        members={members}
                        onStatusChange={handleStatusChange}
                        updatingTaskIds={updatingTaskIds}
                        labels={labels}
                        labelIdsByTask={labelIdsByTask}
                        onEdit={(task) => setEditingTaskId(task.id)}
                    />
                ) : (
                    tasks.length === 0 ? (
                        <div className="border border-dashed border-slate-700 rounded-2xl p-10 text-center">
                            <ClipboardList
                                className="mx-auto text-slate-400 mb-3"
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
                            <Search size={32} className="mx-auto mb-3 text-slate-400" />
                            <h3 className="font-medium text-slate-200">No matching tasks</h3>
                            <p className="mt-2 text-sm text-slate-400">Try changing your search or filters.</p>
                            <button
                                type="button"
                                onClick={resetFilters}
                                className="mt-4 text-sm font-medium text-indigo-400 hover:text-indigo-300"
                            >
                                Clear all filters
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredTasks.map((task) => (
                                <TaskListItem
                                    key={task.id}
                                    task={task}
                                    members={members}
                                    isUpdating={updatingTaskIds.includes(task.id)}
                                    onStatusChange={handleStatusChange}
                                    onAssigneeChange={handleAssigneeChange}
                                    comments={comments}
                                    currentUserId={currentUserId}
                                    isProjectAdmin={isProjectAdmin}
                                    onEdit={() => setEditingTaskId(task.id)}
                                    labels={labels}
                                    labelIds={labelIdsByTask[task.id]}
                                />
                            ))}
                        </div>
                    )
                )}

                </section>
                )}

                {/* Create task modal */}
                {showTaskForm && (
                    <TaskFormModal
                        projectId={projectId}
                        members={members}
                        onSaved={handleTaskCreated}
                        onClose={() => setShowTaskForm(false)}
                        onError={notifyError}
                        labels={labels}
                        onLabelsSaved={handleLabelsSaved}
                    />
                )}

                {/* Edit task modal (closes by itself if the task is deleted elsewhere) */}
                {editingTask && (
                    <TaskFormModal
                        key={editingTask.id}
                        projectId={projectId}
                        members={members}
                        task={editingTask}
                        canDelete={canDeleteTask(editingTask)}
                        onSaved={handleTaskSaved}
                        onDeleted={handleTaskDeleted}
                        onClose={() => setEditingTaskId(null)}
                        onError={notifyError}
                        labels={labels}
                        initialLabelIds={labelIdsByTask[editingTask.id] ?? []}
                        currentUserId={currentUserId}
                        isProjectAdmin={isProjectAdmin}
                        onLabelsSaved={handleLabelsSaved}
                    />
                )}
            </div>
        </div>
    )
}

export default ProjectDetails
