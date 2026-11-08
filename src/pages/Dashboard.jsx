
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useLocation, useNavigate } from 'react-router-dom'

import {
    Plus,
    FolderKanban,
    CalendarDays,
    LogOut,
    X,
    ArrowUpRight,
    Mail,
    Check,
    Clock,
    Bell,
    CheckCheck,
} from 'lucide-react'

import { useAuth } from '../context/useAuth'

import {
    getProjects,
    createProject,
} from '../lib/projectService'

import {
    getMyInvitations,
    acceptProjectInvitation,
} from '../lib/invitationService'

import {
    getNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
} from '../lib/notificationService'

import { getMyProfile } from '../lib/profileService'


function formatNotificationDate(date) {
    return new Date(date).toLocaleString([], {
        dateStyle: 'medium',
        timeStyle: 'short',
    })
}


function Dashboard() {
    const { user, logout } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()

    // One-time message passed from another page, e.g. after deleting a project.
    const [flashMessage, setFlashMessage] = useState(
        () => location.state?.message || ''
    )

    // Profile from the profiles table (kept up to date by Profile Settings).
    const [profile, setProfile] = useState(null)

    const [projects, setProjects] = useState([])
    const [invitations, setInvitations] = useState([])

    const [loading, setLoading] = useState(true)
    const [invitationLoading, setInvitationLoading] = useState(true)
    const [acceptingInvitation, setAcceptingInvitation] = useState(null)

    const [creating, setCreating] = useState(false)
    const [saving, setSaving] = useState(false)

    const [error, setError] = useState('')
    const [invitationError, setInvitationError] = useState('')

    const [projectName, setProjectName] = useState('')
    const [description, setDescription] = useState('')

    // Notification state
    const [notifications, setNotifications] = useState([])
    const [notificationsOpen, setNotificationsOpen] = useState(false)
    const [notificationLoading, setNotificationLoading] = useState(true)
    const [notificationError, setNotificationError] = useState('')
    const [markingAllRead, setMarkingAllRead] = useState(false)

    const unreadCount = notifications.filter(
        (notification) => !notification.is_read
    ).length

    // Profile display information. Prefer the profiles table, which is
    // what Profile Settings updates; fall back to signup metadata.
    const displayName =
        profile?.full_name ||
        user?.user_metadata?.full_name ||
        user?.email?.split('@')[0] ||
        'User'

    const profileInitial = displayName.charAt(0).toUpperCase()

    // Clear the one-time message from browser history so it does not
    // reappear on refresh or when navigating back.
    useEffect(() => {
        if (location.state?.message) {
            navigate(location.pathname, { replace: true, state: null })
        }
    }, [location.pathname, location.state, navigate])

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
            } catch (err) {
                console.error('Loading projects failed:', err)
                setError(err.message || 'Unable to load projects.')
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
                    err.message || 'Unable to load invitations.'
                )
            } finally {
                setInvitationLoading(false)
            }
        }

        loadInvitations()
    }, [])

    // Fetch notifications and listen for Realtime changes
    useEffect(() => {
        if (!user?.id) return

        let active = true

        async function loadNotifications() {
            try {
                const data = await getNotifications()

                if (active) {
                    setNotifications((previous) => {
                        const notificationMap = new Map()

                        data.forEach((item) => {
                            notificationMap.set(item.id, item)
                        })

                        previous.forEach((item) => {
                            notificationMap.set(item.id, item)
                        })

                        return Array.from(notificationMap.values()).sort(
                            (a, b) =>
                                new Date(b.created_at) -
                                new Date(a.created_at)
                        )
                    })
                }
            } catch (err) {
                console.error('Loading notifications failed:', err)

                if (active) {
                    setNotificationError(
                        err.message || 'Unable to load notifications.'
                    )
                }
            } finally {
                if (active) {
                    setNotificationLoading(false)
                }
            }
        }

        // A unique channel name per mount avoids reusing a channel that is
        // still closing from a previous mount (e.g. React StrictMode in dev).
        const channel = supabase
            .channel(`user-notifications-${user.id}-${crypto.randomUUID()}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.id}`,
                },
                (payload) => {
                    if (!active) return

                    if (payload.eventType === 'INSERT') {
                        const newNotification = payload.new

                        setNotifications((previous) => {
                            if (
                                previous.some(
                                    (item) => item.id === newNotification.id
                                )
                            ) {
                                return previous
                            }

                            return [newNotification, ...previous]
                        })
                    }

                    if (payload.eventType === 'UPDATE') {
                        const updatedNotification = payload.new

                        setNotifications((previous) =>
                            previous.map((item) =>
                                item.id === updatedNotification.id
                                    ? { ...item, ...updatedNotification }
                                    : item
                            )
                        )
                    }

                    if (payload.eventType === 'DELETE') {
                        setNotifications((previous) =>
                            previous.filter(
                                (item) => item.id !== payload.old.id
                            )
                        )
                    }
                }
            )
            .subscribe((status) => {
                if (status === 'CHANNEL_ERROR') {
                    console.error('Notification Realtime connection failed.')
                }
            })

        loadNotifications()

        return () => {
            active = false
            supabase.removeChannel(channel)
        }
    }, [user?.id])

    // Create a new project
    const handleCreateProject = async (e) => {
        e.preventDefault()
        setError('')

        if (!projectName.trim()) {
            setError('Project name is required.')
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

            setProjectName('')
            setDescription('')
            setCreating(false)
        } catch (err) {
            console.error('Project creation failed:', err)
            setError(err.message || 'Unable to create project.')
        } finally {
            setSaving(false)
        }
    }

    // Accept an invitation
    const handleAcceptInvitation = async (invitation) => {
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
                err.message || 'Unable to accept this invitation.'
            )
        } finally {
            setAcceptingInvitation(null)
        }
    }

    // Mark one notification as read
    const handleNotificationClick = async (notification) => {
        setNotificationError('')

        try {
            if (!notification.is_read) {
                await markNotificationAsRead(notification.id)

                setNotifications((previous) =>
                    previous.map((item) =>
                        item.id === notification.id
                            ? { ...item, is_read: true }
                            : item
                    )
                )
            }

            setNotificationsOpen(false)

            if (notification.project_id) {
                navigate(`/projects/${notification.project_id}`)
            }
        } catch (err) {
            console.error('Mark notification as read failed:', err)
            setNotificationError(
                err.message || 'Unable to update notification.'
            )
        }
    }

    // Mark all notifications as read
    const handleMarkAllAsRead = async () => {
        setNotificationError('')
        setMarkingAllRead(true)

        try {
            await markAllNotificationsAsRead()

            setNotifications((previous) =>
                previous.map((item) => ({
                    ...item,
                    is_read: true,
                }))
            )
        } catch (err) {
            console.error('Mark all notifications failed:', err)
            setNotificationError(
                err.message || 'Unable to mark notifications as read.'
            )
        } finally {
            setMarkingAllRead(false)
        }
    }

    // Logout current user
    const handleLogout = async () => {
        const { error } = await logout()

        if (error) {
            setError(error.message)
            return
        }

        navigate('/login', { replace: true })
    }

    // Open project workspace
    const openProject = (projectId) => {
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
                <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">

                    <h1 className="text-2xl font-bold">
                        Dev<span className="text-indigo-400">Space</span>
                    </h1>

                    <div className="flex items-center gap-3 sm:gap-4">

                        {/* Notification bell */}
                        <div className="relative">

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
                                <div className="absolute right-0 top-full z-50 mt-3 w-[min(90vw,380px)] overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">

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
                                                    className="mx-auto text-slate-500"
                                                />

                                                <p className="mt-3 text-sm font-medium text-slate-300">
                                                    No notifications yet
                                                </p>

                                                <p className="mt-1 text-xs text-slate-500">
                                                    Your notifications will appear here.
                                                </p>

                                            </div>

                                        ) : (

                                            <div>
                                                {notifications.map((notification) => (
                                                    <button
                                                        type="button"
                                                        key={notification.id}
                                                        onClick={() =>
                                                            handleNotificationClick(notification)
                                                        }
                                                        className={`w-full border-b border-slate-800 p-4 text-left transition hover:bg-slate-800/70 ${!notification.is_read
                                                                ? 'bg-indigo-500/5'
                                                                : ''
                                                            }`}
                                                    >

                                                        <div className="flex items-start gap-3">

                                                            <div className="mt-1 rounded-lg bg-indigo-500/10 p-2 text-indigo-400">
                                                                <Bell size={17} />
                                                            </div>

                                                            <div className="min-w-0 flex-1">

                                                                <div className="flex items-start justify-between gap-2">

                                                                    <p className="text-sm font-semibold text-slate-200">
                                                                        {notification.title}
                                                                    </p>

                                                                    {!notification.is_read && (
                                                                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-indigo-400" />
                                                                    )}

                                                                </div>

                                                                <p className="mt-1 text-xs leading-5 text-slate-400">
                                                                    {notification.message}
                                                                </p>

                                                                <p className="mt-2 text-xs text-slate-500">
                                                                    {formatNotificationDate(notification.created_at)}
                                                                </p>

                                                            </div>

                                                        </div>

                                                    </button>
                                                ))}
                                            </div>

                                        )}

                                    </div>

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
            <main className="mx-auto max-w-7xl px-6 py-12">

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

                {/* One-time success message (e.g. after deleting a project) */}
                {flashMessage && (
                    <div
                        role="status"
                        className="mt-6 flex items-start justify-between gap-3 rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-400"
                    >
                        <p>{flashMessage}</p>

                        <button
                            onClick={() => setFlashMessage('')}
                            aria-label="Dismiss message"
                        >
                            <X size={18} />
                        </button>
                    </div>
                )}

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
                                className="mx-auto text-slate-500"
                            />

                            <p className="mt-3 font-medium text-slate-300">
                                No pending invitations
                            </p>

                            <p className="mt-1 text-sm text-slate-500">
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

                                    <div className="mt-5 flex flex-wrap gap-4 border-t border-slate-800 pt-4 text-xs text-slate-500">

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

                                    <button
                                        onClick={() => handleAcceptInvitation(invitation)}
                                        disabled={
                                            acceptingInvitation === invitation.invitation_id
                                        }
                                        className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-500 px-4 py-3 text-sm font-semibold transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <Check size={17} />

                                        {acceptingInvitation === invitation.invitation_id
                                            ? 'Accepting...'
                                            : 'Accept Invitation'}
                                    </button>

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

                    <h3 className="mb-6 text-xl font-semibold">
                        Your Projects
                    </h3>

                    {loading ? (

                        <p className="text-slate-400">
                            Loading projects...
                        </p>

                    ) : projects.length === 0 ? (

                        <div className="rounded-xl border border-dashed border-slate-700 p-12 text-center">

                            <FolderKanban
                                size={40}
                                className="mx-auto text-slate-500"
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

                    ) : (

                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">

                            {projects.map((project) => (

                                <button
                                    key={project.id}
                                    type="button"
                                    onClick={() => openProject(project.id)}
                                    className="w-full rounded-xl border border-slate-800 bg-slate-900 p-6 text-left transition hover:-translate-y-1 hover:border-indigo-500/60 hover:bg-slate-900/80 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >

                                    <div className="flex items-center justify-between">

                                        <div className="rounded-lg bg-indigo-500/10 p-3 text-indigo-400">
                                            <FolderKanban size={22} />
                                        </div>

                                        <div className="flex items-center gap-2">

                                            <span className="rounded-full bg-indigo-500/10 px-3 py-1 text-xs text-indigo-400">
                                                Project
                                            </span>

                                            <ArrowUpRight
                                                size={17}
                                                className="text-slate-500"
                                            />

                                        </div>
                                    </div>

                                    <h4 className="mt-5 text-lg font-semibold">
                                        {project.name}
                                    </h4>

                                    <p className="mt-2 min-h-12 text-sm text-slate-400">
                                        {project.description || 'No description provided.'}
                                    </p>

                                    <div className="mt-5 flex items-center gap-2 border-t border-slate-800 pt-4 text-xs text-slate-500">

                                        <CalendarDays size={14} />

                                        Created{' '}
                                        {new Date(
                                            project.created_at
                                        ).toLocaleDateString()}

                                    </div>

                                </button>

                            ))}

                        </div>

                    )}

                </section>

            </main>

            {/* Create project modal */}
            {creating && (

                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">

                    <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-7">

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

                                <label className="mb-2 block text-sm text-slate-300">
                                    Project Name
                                </label>

                                <input
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

                                <label className="mb-2 block text-sm text-slate-300">
                                    Description
                                </label>

                                <textarea
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
