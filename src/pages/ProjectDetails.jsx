
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
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
import { useTaskComments } from '../hooks/useTaskComments'
import { useToast } from '../context/useToast'

import TaskKanbanBoard from '../components/project/TaskKanbanBoard'
import TaskReminders from '../components/project/TaskReminders'
import ProjectActivityFeed from '../components/project/ProjectActivityFeed'
import ProjectSettingsPanel from '../components/project/ProjectSettingsPanel'
import ProjectMembersPanel from '../components/project/ProjectMembersPanel'
import OwnershipTransferPanel from '../components/project/OwnershipTransferPanel'
import ProjectDangerZone from '../components/project/ProjectDangerZone'
import InvitationsPanel from '../components/project/InvitationsPanel'
import TaskFilters from '../components/project/TaskFilters'
import TaskListItem from '../components/project/TaskListItem'
import CreateTaskModal from '../components/project/CreateTaskModal'
import {
    DEFAULT_TASK_FILTERS,
    filterAndSortTasks,
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
    const [updatingTaskIds, setUpdatingTaskIds] = useState([])
    const [taskView, setTaskView] = useState('list')

    // Task search, filters and sorting.
    const [filters, setFilters] = useState(DEFAULT_TASK_FILTERS)

    // Comments for all tasks (state, handlers and realtime sync).
    // Action errors appear as pop-up notices. Empty messages (used by
    // panels to clear a previous error) are ignored.
    const toast = useToast()
    const notifyError = useCallback((message) => {
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
    function handleTaskCreated(newTask) {
        setTasks((previous) => [
            newTask,
            ...previous.filter((task) => task.id !== newTask.id),
        ])
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
        patchTask(taskId, { [field]: value })

        try {
            await saveFn(taskId, value)
        } catch (err) {
            patchTask(taskId, { [field]: previousValue })
            notifyError(err.message || errorMessage)
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

    const filteredTasks = filterAndSortTasks(tasks, filters)

    function resetFilters() {
        setFilters(DEFAULT_TASK_FILTERS)
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

                <ProjectSettingsPanel
                    project={project}
                    projectId={projectId}
                    isProjectAdmin={isProjectAdmin}
                    onProjectChange={setProject}
                    onError={notifyError}
                />

                <ProjectMembersPanel
                    projectId={projectId}
                    members={members}
                    currentUserId={currentUserId}
                    isProjectOwner={isProjectOwner}
                    isProjectAdmin={isProjectAdmin}
                    onMembersChange={setMembers}
                    onError={notifyError}
                />

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

                <ProjectDangerZone
                    project={project}
                    projectId={projectId}
                    isProjectOwner={isProjectOwner}
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

                <TaskFilters
                    filters={filters}
                    onChange={setFilters}
                    onReset={resetFilters}
                    members={members}
                    shownCount={filteredTasks.length}
                    totalCount={tasks.length}
                />

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
                                />
                            ))}
                        </div>
                    )
                )}

                {/* Create task modal */}
                {showTaskForm && (
                    <CreateTaskModal
                        projectId={projectId}
                        members={members}
                        onCreated={handleTaskCreated}
                        onClose={() => setShowTaskForm(false)}
                        onError={notifyError}
                    />
                )}
            </div>
        </div>
    )
}

export default ProjectDetails
