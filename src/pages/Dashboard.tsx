
import { getErrorMessage } from '../lib/errors'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { Notification, Project } from '../types/app'
import type { MyProfile } from '../lib/profileService'
import type { ProjectSummary } from '../lib/projectService'
import type { MyInvitation } from '../lib/invitationService'
import { useLocation, useNavigate } from 'react-router-dom'

import {
    Plus,
    FolderKanban,
    CalendarDays,
    LogOut,
    X,
    Mail,
    Check,
    Clock,
    Bell,
    CheckCheck,
    Search,
} from 'lucide-react'

import { useAuth } from '../context/useAuth'

import {
    getProjects,
    createProject,
    getProjectSummaries,
} from '../lib/projectService'

import ProjectCard from '../components/dashboard/ProjectCard'

import {
    getMyInvitations,
    acceptProjectInvitation,
    declineProjectInvitation,
} from '../lib/invitationService'

import { useNotifications } from '../hooks/useNotifications'
import NotificationItem from '../components/notifications/NotificationItem'
import { getNotificationLink } from '../components/notifications/notificationUtils'

import { getMyProfile } from '../lib/profileService'
import { useDismiss } from '../hooks/useDismiss'
import { useDialogFocus } from '../hooks/useDialogFocus'
import { useToast } from '../context/useToast'


function Dashboard() {
    const { user, logout } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()

    const toast = useToast()

    // Remembers which navigation's one-time message was already shown, so
    // React StrictMode's double effect run does not show it twice.
    const shownMessageKey = useRef<string | null>(null)

    // Profile from the profiles table (kept up to date by Profile Settings).
    const [profile, setProfile] = useState<MyProfile | null>(null)

    const [projects, setProjects] = useState<Project[]>([])
    // Per-project role and task counts, keyed by project ID.
    const [projectSummaries, setProjectSummaries] = useState<Record<string, ProjectSummary>>({})
    const [projectSearch, setProjectSearch] = useState('')
    const [invitations, setInvitations] = useState<MyInvitation[]>([])

    const [loading, setLoading] = useState(true)
    const [invitationLoading, setInvitationLoading] = useState(true)
    const [acceptingInvitation, setAcceptingInvitation] = useState<string | null>(null)
    const [decliningInvitation, setDecliningInvitation] = useState<string | null>(null)

    const [creating, setCreating] = useState(false)
    const [saving, setSaving] = useState(false)

    const [error, setError] = useState('')
    const [invitationError, setInvitationError] = useState('')

    const [projectName, setProjectName] = useState('')
    const [description, setDescription] = useState('')

    // Notifications (shared with the Notifications page) and dropdown state
    const [notificationsOpen, setNotificationsOpen] = useState(false)
    const {
        notifications,
        unreadCount,
        loading: notificationLoading,
        error: notificationError,
        markingAllRead,
        markAsRead,
        markAllAsRead: handleMarkAllAsRead,
    } = useNotifications(user?.id)

    // The dropdown shows only the most recent few; the rest are on /notifications.
    const recentNotifications = notifications.slice(0, 8)

    // Close the notification dropdown and the create-project modal on
    // Escape or a click outside them.
    const notificationMenuRef = useRef<HTMLDivElement>(null)
    const createDialogRef = useRef<HTMLDivElement>(null)

    useDismiss(notificationMenuRef, notificationsOpen, () => setNotificationsOpen(false))
    useDialogFocus(createDialogRef, creating)
    useDismiss(createDialogRef, creating && !saving, () => {
        setCreating(false)
        setError('')
    })

    // Profile display information. Prefer the profiles table, which is
    // what Profile Settings updates; fall back to signup metadata.
    const displayName =
        profile?.full_name ||
        user?.user_metadata?.full_name ||
        user?.email?.split('@')[0] ||
        'User'

    const profileInitial = displayName.charAt(0).toUpperCase()

    // Show a one-time message passed from another page (e.g. after deleting
    // or leaving a project), then clear it from browser history so it does
    // not reappear on refresh or when navigating back.
    useEffect(() => {
        const message = location.state?.message
        if (!message) return

        if (shownMessageKey.current !== location.key) {
            shownMessageKey.current = location.key
            toast.success(message)
        }

        navigate(location.pathname, { replace: true, state: null })
    }, [location.key, location.pathname, location.state, navigate, toast])

    // Fetch the user's profile (name and avatar)
    useEffect(() => {
        let active = true

        getMyProfile()
            .then((data) => {
                if (active) setProfile(data)
            })
            .catch((err) => {
                console.error('Loading profile failed:', err)
            })

        return () => {
            active = false
        }
    }, [])

    // Fetch projects
    useEffect(() => {
        async function loadProjects() {
            try {
                const data = await getProjects()
                setProjects(data)

                // Role and task counts are extras: if they fail to load,
                // the cards simply show without them.
                try {
                    const summaries = await getProjectSummaries(
                        data.map((project) => project.id)
                    )
                    setProjectSummaries(summaries)
                } catch (summaryError) {
                    console.error('Loading project summaries failed:', summaryError)
                }
            } catch (err) {
                console.error('Loading projects failed:', err)
                setError(getErrorMessage(err, 'Unable to load projects.'))
            } finally {
                setLoading(false)
            }
        }

        loadProjects()
    }, [])

    // Fetch invitations
    useEffect(() => {
        async function loadInvitations() {
            try {
                const data = await getMyInvitations()
                setInvitations(data)
            } catch (err) {
                console.error('Loading invitations failed:', err)
                setInvitationError(
                    getErrorMessage(err, 'Unable to load invitations.')
                )
            } finally {
                setInvitationLoading(false)
            }
        }

        loadInvitations()
    }, [])

    // Create a new project
    const handleCreateProject = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setError('')

        if (!projectName.trim()) {
            toast.error('Project name is required.')
            return
        }

        setSaving(true)

        try {
            const newProject = await createProject({
                name: projectName.trim(),
                description: description.trim(),
            })

            setProjects((previous) => [
                newProject,
                ...previous,
            ])

            setProjectSummaries((previous) => ({
                ...previous,
                [newProject.id]: { role: 'owner', total: 0, done: 0, inProgress: 0 },
            }))

            setProjectName('')
            setDescription('')
            setCreating(false)
            toast.success(`Project "${newProject.name}" created.`)
        } catch (err) {
            console.error('Project creation failed:', err)
            toast.error(getErrorMessage(err, 'Unable to create project.'))
        } finally {
            setSaving(false)
        }
    }

    // Accept an invitation
    // Decline an invitation (after confirmation) and remove it from the list
    const handleDeclineInvitation = async (invitation: MyInvitation) => {
        const confirmed = window.confirm(
            `Decline the invitation to "${invitation.project_name}"?`
        )

        if (!confirmed) return

        setInvitationError('')
        setDecliningInvitation(invitation.invitation_id)

        try {
            await declineProjectInvitation(invitation.invitation_id)

            setInvitations((previous) =>
                previous.filter(
                    (item) => item.invitation_id !== invitation.invitation_id
                )
            )

            toast.success(`Declined the invitation to "${invitation.project_name}".`)
        } catch (err) {
            console.error('Decline invitation failed:', err)
            setInvitationError(
                getErrorMessage(err, 'Unable to decline this invitation.')
            )
        } finally {
            setDecliningInvitation(null)
        }
    }

    const handleAcceptInvitation = async (invitation: MyInvitation) => {
        setInvitationError('')
        setAcceptingInvitation(invitation.invitation_id)

        try {
            const projectId = await acceptProjectInvitation(
                invitation.invitation_id
            )

            setInvitations((previous) =>
                previous.filter(
                    (item) => item.invitation_id !== invitation.invitation_id
                )
            )

            // Go straight to the project the user just joined.
            navigate(`/projects/${projectId}`)
        } catch (err) {
            console.error('Accept invitation failed:', err)
            setInvitationError(
                getErrorMessage(err, 'Unable to accept this invitation.')
            )
        } finally {
            setAcceptingInvitation(null)
        }
    }

    // Mark a notification as read and open what it refers to
    const handleNotificationClick = async (notification: Notification) => {
        const updated = await markAsRead(notification)
        if (!updated) return

        setNotificationsOpen(false)

        const link = getNotificationLink(notification)
        if (link) navigate(link)
    }

    // Logout current user
    const handleLogout = async () => {
        const { error } = await logout()

        if (error) {
            toast.error(error.message)
            return
        }

        navigate('/login', { replace: true })
    }

    // Projects matching the search box (name or description).
    const searchTerm = projectSearch.trim().toLowerCase()
    const filteredProjects = searchTerm
        ? projects.filter((project) =>
            `${project.name} ${project.description || ''}`
                .toLowerCase()
                .includes(searchTerm)
        )
        : projects

    // Open project workspace
    const openProject = (projectId: string) => {
        navigate(`/projects/${projectId}`)
    }

    // Open profile settings
    const openProfileSettings = () => {
        navigate('/profile')
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white">

            {/* Navigation */}
            <header className="border-b border-slate-800">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6">

                    <h1 className="text-2xl font-bold">
                        Dev<span className="text-indigo-400">Space</span>
                    </h1>

                    <div className="flex items-center gap-3 sm:gap-4">

                        {/* Notification bell */}
                        <div ref={notificationMenuRef} className="relative">

                            <button
                                type="button"
                                onClick={() =>
                                    setNotificationsOpen((previous) => !previous)
                                }
                                aria-label="Open notifications"
                                aria-expanded={notificationsOpen}
                                className="relative rounded-lg border border-slate-700 p-2.5 text-slate-300 transition hover:bg-slate-800 hover:text-white"
                            >
                                <Bell size={20} />

                                {unreadCount > 0 && (
                                    <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
                                        {unreadCount > 99 ? '99+' : unreadCount}
                                    </span>
                                )}
                            </button>

                            {/* Notification dropdown */}
                            {notificationsOpen && (
                                // Phones: span the screen below the header (the bell is not at the
                                // screen edge, so anchoring to it pushed the menu off-screen).
                                // From sm up: drop down from the bell.
                                <div className="fixed inset-x-4 top-24 z-50 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-3 sm:w-[380px]">

                                    <div className="flex items-center justify-between border-b border-slate-800 p-4">

                                        <div>
                                            <h3 className="font-semibold">
                                                Notifications
                                            </h3>

                                            <p className="mt-1 text-xs text-slate-400">
                                                {unreadCount} unread notifications
                                            </p>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => setNotificationsOpen(false)}
                                            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                                            aria-label="Close notifications"
                                        >
                                            <X size={18} />
                                        </button>

                                    </div>

                                    {notificationError && (
                                        <div className="border-b border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
                                            {notificationError}
                                        </div>
                                    )}

                                    {unreadCount > 0 && (
                                        <div className="flex justify-end border-b border-slate-800 px-4 py-2">

                                            <button
                                                type="button"
                                                onClick={handleMarkAllAsRead}
                                                disabled={markingAllRead}
                                                className="flex items-center gap-2 text-xs font-medium text-indigo-400 hover:text-indigo-300 disabled:opacity-50"
                                            >
                                                <CheckCheck size={15} />

                                                {markingAllRead
                                                    ? 'Updating...'
                                                    : 'Mark all as read'}
                                            </button>

                                        </div>
                                    )}

                                    <div className="max-h-96 overflow-y-auto">

                                        {notificationLoading ? (

                                            <p className="p-8 text-center text-sm text-slate-400">
                                                Loading notifications...
                                            </p>

                                        ) : notifications.length === 0 ? (

                                            <div className="p-8 text-center">

                                                <Bell
                                                    size={30}
                                                    className="mx-auto text-slate-400"
                                                />

                                                <p className="mt-3 text-sm font-medium text-slate-300">
                                                    No notifications yet
                                                </p>

                                                <p className="mt-1 text-xs text-slate-400">
                                                    Your notifications will appear here.
                                                </p>

                                            </div>

                                        ) : (

                                            <div>
                                                {recentNotifications.map((notification) => (
                                                    <NotificationItem
                                                        key={notification.id}
                                                        notification={notification}
                                                        onClick={handleNotificationClick}
                                                    />
                                                ))}
                                            </div>

                                        )}

                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setNotificationsOpen(false)
                                            navigate('/notifications')
                                        }}
                                        className="w-full border-t border-slate-800 p-3 text-center text-sm font-medium text-indigo-400 transition hover:bg-slate-800/70 hover:text-indigo-300"
                                    >
                                        View all notifications
                                    </button>

                                </div>
                            )}

                        </div>

                        {/* Profile Settings button */}
                        <button
                            type="button"
                            onClick={openProfileSettings}
                            title="Profile Settings"
                            aria-label="Open Profile Settings"
                            className="flex items-center gap-2 rounded-lg border border-slate-700 p-2 transition hover:border-indigo-500 hover:bg-slate-800 sm:px-3"
                        >
                            <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-indigo-500 text-sm font-bold text-white">
                                {profile?.avatar_url ? (
                                    <img
                                        src={profile.avatar_url}
                                        alt=""
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    profileInitial
                                )}
                            </span>

                            <span className="hidden text-sm font-medium text-slate-300 sm:block">
                                Profile
                            </span>
                        </button>

                        <span className="hidden text-sm text-slate-400 lg:block">
                            {user?.email}
                        </span>

                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm transition hover:bg-slate-800 sm:px-4"
                        >
                            <LogOut size={16} />
                            <span className="hidden sm:inline">Logout</span>
                        </button>

                    </div>
                </div>
            </header>

            {/* Main dashboard */}
            <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">

                {/* Heading */}
                <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">

                    <div>
                        <h2 className="text-3xl font-bold">
                            Your workspace
                        </h2>

                        <p className="mt-2 text-slate-400">
                            Manage your projects and collaborate with your team.
                        </p>
                    </div>

                    <button
                        onClick={() => {
                            setError('')
                            setCreating(true)
                        }}
                        className="flex items-center justify-center gap-2 rounded-lg bg-indigo-500 px-5 py-3 font-semibold transition hover:bg-indigo-600"
                    >
                        <Plus size={19} />
                        New Project
                    </button>

                </div>

                {/* General error message */}
                {error && (
                    <div className="mt-6 flex items-start justify-between gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">

                        <p>{error}</p>

                        <button
                            onClick={() => setError('')}
                            aria-label="Dismiss error"
                        >
                            <X size={18} />
                        </button>

                    </div>
                )}

                {/* Received invitations */}
                <section className="mt-10">

                    <div className="mb-6 flex items-center gap-3">

                        <div className="rounded-lg bg-indigo-500/10 p-3 text-indigo-400">
                            <Mail size={22} />
                        </div>

                        <div>
                            <h3 className="text-xl font-semibold">
                                Project Invitations
                            </h3>

                            <p className="mt-1 text-sm text-slate-400">
                                Invitations from other project teams.
                            </p>
                        </div>

                        {invitations.length > 0 && (
                            <span className="ml-auto rounded-full bg-indigo-500/10 px-3 py-1 text-sm text-indigo-400">
                                {invitations.length} pending
                            </span>
                        )}

                    </div>

                    {invitationError && (
                        <div className="mb-5 flex items-start justify-between gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
                            <p>{invitationError}</p>

                            <button
                                onClick={() => setInvitationError('')}
                                aria-label="Dismiss invitation error"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    )}

                    {invitationLoading ? (
                        <p className="text-sm text-slate-400">
                            Loading invitations...
                        </p>
                    ) : invitations.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center">

                            <Mail
                                size={30}
                                className="mx-auto text-slate-400"
                            />

                            <p className="mt-3 font-medium text-slate-300">
                                No pending invitations
                            </p>

                            <p className="mt-1 text-sm text-slate-400">
                                When someone invites you to a project, it will appear here.
                            </p>

                        </div>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2">

                            {invitations.map((invitation) => (
                                <div
                                    key={invitation.invitation_id}
                                    className="rounded-xl border border-slate-800 bg-slate-900 p-6"
                                >

                                    <div className="flex items-start justify-between gap-3">

                                        <div>
                                            <h4 className="text-lg font-semibold">
                                                {invitation.project_name}
                                            </h4>

                                            <p className="mt-2 text-sm text-slate-400">
                                                Invited by{' '}
                                                <span className="text-slate-300">
                                                    {invitation.invited_by_name}
                                                </span>
                                            </p>
                                        </div>

                                        <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs text-amber-400">
                                            Pending
                                        </span>

                                    </div>

                                    <div className="mt-5 flex flex-wrap gap-4 border-t border-slate-800 pt-4 text-xs text-slate-400">

                                        <span className="flex items-center gap-2">
                                            <CalendarDays size={14} />
                                            Invited{' '}
                                            {new Date(
                                                invitation.created_at
                                            ).toLocaleDateString()}
                                        </span>

                                        {invitation.expires_at && (
                                            <span className="flex items-center gap-2">
                                                <Clock size={14} />
                                                Expires{' '}
                                                {new Date(
                                                    invitation.expires_at
                                                ).toLocaleDateString()}
                                            </span>
                                        )}

                                    </div>

                                    <div className="mt-5 flex gap-3">
                                        <button
                                            type="button"
                                            onClick={() => handleAcceptInvitation(invitation)}
                                            disabled={
                                                acceptingInvitation === invitation.invitation_id ||
                                                decliningInvitation === invitation.invitation_id
                                            }
                                            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-500 px-4 py-3 text-sm font-semibold transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            <Check size={17} />

                                            {acceptingInvitation === invitation.invitation_id
                                                ? 'Accepting...'
                                                : 'Accept Invitation'}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => handleDeclineInvitation(invitation)}
                                            disabled={
                                                acceptingInvitation === invitation.invitation_id ||
                                                decliningInvitation === invitation.invitation_id
                                            }
                                            className="flex items-center justify-center gap-2 rounded-lg border border-slate-700 px-4 py-3 text-sm text-slate-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            <X size={17} />

                                            {decliningInvitation === invitation.invitation_id
                                                ? 'Declining...'
                                                : 'Decline'}
                                        </button>
                                    </div>

                                </div>
                            ))}

                        </div>
                    )}

                </section>

                {/* Project statistics */}
                <div className="mt-12 rounded-xl border border-slate-800 bg-slate-900 p-6">

                    <div className="flex items-center gap-4">

                        <div className="rounded-lg bg-indigo-500/10 p-3 text-indigo-400">
                            <FolderKanban size={25} />
                        </div>

                        <div>
                            <p className="text-sm text-slate-400">
                                Total Projects
                            </p>

                            <p className="text-2xl font-bold">
                                {projects.length}
                            </p>
                        </div>

                    </div>
                </div>

                {/* Projects section */}
                <section className="mt-12">

                    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <h3 className="text-xl font-semibold">
                            Your Projects
                        </h3>

                        {projects.length > 0 && (
                            <label className="relative block w-full sm:w-72">
                                <Search
                                    size={16}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                />
                                <input
                                    type="search"
                                    value={projectSearch}
                                    onChange={(e) => setProjectSearch(e.target.value)}
                                    placeholder="Search projects..."
                                    aria-label="Search projects"
                                    className="w-full rounded-lg border border-slate-700 bg-slate-900 py-2.5 pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-500"
                                />
                            </label>
                        )}
                    </div>

                    {loading ? (

                        <p className="text-slate-400">
                            Loading projects...
                        </p>

                    ) : projects.length === 0 ? (

                        <div className="rounded-xl border border-dashed border-slate-700 p-12 text-center">

                            <FolderKanban
                                size={40}
                                className="mx-auto text-slate-400"
                            />

                            <h4 className="mt-4 text-lg font-semibold">
                                No projects yet
                            </h4>

                            <p className="mt-2 text-sm text-slate-400">
                                Create your first project to get started.
                            </p>

                            <button
                                onClick={() => {
                                    setError('')
                                    setCreating(true)
                                }}
                                className="mt-6 rounded-lg bg-indigo-500 px-5 py-2.5 text-sm font-semibold hover:bg-indigo-600"
                            >
                                Create your first project
                            </button>

                        </div>

                    ) : filteredProjects.length === 0 ? (

                        <div className="rounded-xl border border-dashed border-slate-700 p-10 text-center">
                            <Search size={30} className="mx-auto text-slate-400" />
                            <p className="mt-3 font-medium text-slate-300">
                                No projects match "{projectSearch.trim()}"
                            </p>
                            <button
                                type="button"
                                onClick={() => setProjectSearch('')}
                                className="mt-3 text-sm font-medium text-indigo-400 hover:text-indigo-300"
                            >
                                Clear search
                            </button>
                        </div>

                    ) : (

                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {filteredProjects.map((project) => (
                                <ProjectCard
                                    key={project.id}
                                    project={project}
                                    summary={projectSummaries[project.id]}
                                    onOpen={() => openProject(project.id)}
                                />
                            ))}
                        </div>

                    )}

                </section>

            </main>

            {/* Create project modal */}
            {creating && (

                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">

                    <div
                        ref={createDialogRef}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Create new project"
                        className="w-full max-w-lg max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-7"
                    >

                        <div className="flex items-center justify-between">

                            <h3 className="text-xl font-bold">
                                Create New Project
                            </h3>

                            <button
                                onClick={() => {
                                    setCreating(false)
                                    setError('')
                                }}
                                className="text-slate-400 transition hover:text-white"
                                aria-label="Close"
                            >
                                <X size={22} />
                            </button>

                        </div>

                        <form
                            onSubmit={handleCreateProject}
                            className="mt-7 space-y-5"
                        >

                            <div>

                                <label htmlFor="new-project-name" className="mb-2 block text-sm text-slate-300">
                                    Project Name
                                </label>

                                <input
                                    id="new-project-name"
                                    type="text"
                                    value={projectName}
                                    onChange={(e) => setProjectName(e.target.value)}
                                    placeholder="e.g. Website Redesign"
                                    maxLength={100}
                                    required
                                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 outline-none focus:border-indigo-400"
                                />

                            </div>

                            <div>

                                <label htmlFor="new-project-description" className="mb-2 block text-sm text-slate-300">
                                    Description
                                </label>

                                <textarea
                                    id="new-project-description"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Describe your project..."
                                    rows={4}
                                    maxLength={1000}
                                    className="w-full resize-none rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 outline-none focus:border-indigo-400"
                                />

                            </div>

                            <div className="flex justify-end gap-3 pt-2">

                                <button
                                    type="button"
                                    onClick={() => {
                                        setCreating(false)
                                        setError('')
                                    }}
                                    className="rounded-lg border border-slate-700 px-5 py-2.5 text-sm transition hover:bg-slate-800"
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="rounded-lg bg-indigo-500 px-5 py-2.5 text-sm font-semibold transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {saving ? 'Creating...' : 'Create Project'}
                                </button>

                            </div>

                        </form>

                    </div>

                </div>

            )}

        </div>
    )
}

export default Dashboard
