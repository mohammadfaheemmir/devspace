
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { getErrorMessage } from '../lib/errors'
import { useNavigate } from 'react-router-dom'
import {
    ArrowLeft,
    Camera,
    UserRound,
    Mail,
    LockKeyhole,
    Save,
    Trash2,
    LoaderCircle,
    ShieldCheck,
    CalendarDays,
    Check,
    Circle,
    LogOut,
} from 'lucide-react'

import {
    getMyProfile,
    updateMyProfile,
    uploadMyAvatar,
    removeMyAvatar,
    updateMyEmail,
    updateMyPassword,
} from '../lib/profileService'
import type { MyProfile } from '../lib/profileService'
import { useToast } from '../context/useToast'
import { useAuth } from '../context/useAuth'
import PasswordInput from '../components/PasswordInput'

function ProfileSettings() {
    const navigate = useNavigate()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const toast = useToast()
    const { logout } = useAuth()

    const [profile, setProfile] = useState<MyProfile | null>(null)
    const [fullName, setFullName] = useState('')
    const [email, setEmail] = useState('')

    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')

    const [loading, setLoading] = useState(true)
    const [savingName, setSavingName] = useState(false)
    const [uploadingAvatar, setUploadingAvatar] = useState(false)
    const [removingAvatar, setRemovingAvatar] = useState(false)
    const [changingEmail, setChangingEmail] = useState(false)
    const [changingPassword, setChangingPassword] = useState(false)

    // Only for a failed profile load; action results are shown as toasts,
    // which stay visible wherever the form is on the page.
    const [error, setError] = useState('')

    useEffect(() => {
        async function loadProfile() {
            try {
                const data = await getMyProfile()

                setProfile(data)
                setFullName(data.full_name || '')
                // Leave the "new email" field empty; the current email
                // is shown separately in a read-only field.
            } catch (err) {
                setError(getErrorMessage(err, 'Unable to load your profile.'))
            } finally {
                setLoading(false)
            }
        }

        loadProfile()
    }, [])

    function showMessage(text: string) {
        toast.success(text)
    }

    function showError(text: string) {
        toast.error(text)
    }

    async function handleSaveName(e: FormEvent<HTMLFormElement>) {
        e.preventDefault()

        try {
            setSavingName(true)

            const updatedProfile = await updateMyProfile(fullName)

            setProfile((previous) => previous && ({
                ...previous,
                ...updatedProfile,
            }))

            setFullName(updatedProfile.full_name ?? '')
            showMessage('Your profile name has been updated.')
        } catch (err) {
            showError(getErrorMessage(err, 'Unable to update your name.'))
        } finally {
            setSavingName(false)
        }
    }

    async function handleAvatarUpload(e: ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]

        if (!file) return

        try {
            setUploadingAvatar(true)

            const avatarUrl = await uploadMyAvatar(file)

            setProfile((previous) => previous && ({
                ...previous,
                avatar_url: avatarUrl,
            }))

            showMessage('Profile picture uploaded successfully.')
        } catch (err) {
            showError(getErrorMessage(err, 'Unable to upload your picture.'))
        } finally {
            setUploadingAvatar(false)
            e.target.value = ''
        }
    }

    async function handleRemoveAvatar() {
        const confirmed = window.confirm(
            'Are you sure you want to remove your profile picture?'
        )

        if (!confirmed) return

        try {
            setRemovingAvatar(true)

            await removeMyAvatar()

            setProfile((previous) => previous && ({
                ...previous,
                avatar_url: null,
            }))

            showMessage('Profile picture removed successfully.')
        } catch (err) {
            showError(getErrorMessage(err, 'Unable to remove your picture.'))
        } finally {
            setRemovingAvatar(false)
        }
    }

    async function handleChangeEmail(e: FormEvent<HTMLFormElement>) {
        e.preventDefault()

        try {
            setChangingEmail(true)

            await updateMyEmail(email)

            setEmail('')
            showMessage(
                'Email change requested. Check your inbox for the verification email and follow its instructions.'
            )
        } catch (err) {
            showError(getErrorMessage(err, 'Unable to update your email.'))
        } finally {
            setChangingEmail(false)
        }
    }

    async function handleChangePassword(e: FormEvent<HTMLFormElement>) {
        e.preventDefault()

        if (newPassword !== confirmPassword) {
            showError('The passwords do not match.')
            return
        }

        try {
            setChangingPassword(true)

            await updateMyPassword(newPassword)

            setNewPassword('')
            setConfirmPassword('')

            showMessage('Your password has been updated successfully.')
        } catch (err) {
            showError(getErrorMessage(err, 'Unable to update your password.'))
        } finally {
            setChangingPassword(false)
        }
    }

    async function handleLogout() {
        const { error: logoutError } = await logout()

        if (logoutError) {
            showError(logoutError.message)
            return
        }

        navigate('/login', { replace: true })
    }

    const displayName =
        profile?.full_name || profile?.email?.split('@')[0] || 'User'

    const initial = displayName.charAt(0).toUpperCase()

    const memberSince = profile?.created_at
        ? new Date(profile.created_at).toLocaleDateString([], { month: 'long', year: 'numeric' })
        : null

    // Buttons only wake up when there is something to save.
    const trimmedName = fullName.trim()
    const nameChanged = trimmedName !== '' && trimmedName !== (profile?.full_name ?? '')

    const trimmedEmail = email.trim()
    const emailChanged = trimmedEmail !== '' && trimmedEmail.toLowerCase() !== (profile?.email ?? '').toLowerCase()

    const passwordLongEnough = newPassword.length >= 8
    const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword
    const avatarBusy = uploadingAvatar || removingAvatar

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center text-slate-300">
                <LoaderCircle className="mr-3 animate-spin" size={22} />
                Loading profile...
            </div>
        )
    }

    return (
        <div className="min-h-screen px-4 py-8 text-white sm:px-6">
            <div className="mx-auto max-w-3xl">

                <button
                    type="button"
                    onClick={() => navigate('/dashboard')}
                    className="mb-6 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
                >
                    <ArrowLeft size={16} />
                    Back to dashboard
                </button>

                <h1 className="sr-only">Account Settings</h1>

                {error && (
                    <div
                        role="alert"
                        className="mb-5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
                    >
                        {error}
                    </div>
                )}

                {/* Profile header: photo, name, email, member since */}
                <section className="mb-6 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70 shadow-xl shadow-black/20">
                    <div aria-hidden="true" className="h-24 bg-gradient-to-r from-indigo-600/40 via-violet-600/30 to-sky-500/20 sm:h-28" />

                    <div className="px-5 pb-6 sm:px-6">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                                {/* Clicking the photo opens the file picker */}
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={avatarBusy}
                                    aria-label={profile?.avatar_url ? 'Change profile picture' : 'Upload profile picture'}
                                    className="group relative -mt-12 flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-slate-900 bg-indigo-600 text-3xl font-bold shadow-lg disabled:cursor-wait"
                                >
                                    {profile?.avatar_url ? (
                                        <img
                                            src={profile.avatar_url}
                                            alt=""
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        initial
                                    )}

                                    <span className={`absolute inset-0 flex items-center justify-center bg-black/55 transition ${avatarBusy ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'}`}>
                                        {avatarBusy ? (
                                            <LoaderCircle size={22} className="animate-spin" />
                                        ) : (
                                            <Camera size={22} />
                                        )}
                                    </span>
                                </button>

                                <div className="min-w-0 sm:pt-4">
                                    <p className="break-words text-xl font-bold tracking-tight sm:text-2xl">{displayName}</p>
                                    <p className="mt-1 flex items-center gap-1.5 break-all text-sm text-slate-400">
                                        <Mail size={14} className="shrink-0" />
                                        {profile?.email}
                                    </p>
                                    {memberSince && (
                                        <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                                            <CalendarDays size={13} className="shrink-0" />
                                            Member since {memberSince}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2 sm:pt-4">
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={avatarBusy}
                                    className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm transition hover:bg-slate-800 disabled:opacity-50"
                                >
                                    <Camera size={15} />
                                    {uploadingAvatar ? 'Uploading...' : profile?.avatar_url ? 'Change photo' : 'Upload photo'}
                                </button>

                                {profile?.avatar_url && (
                                    <button
                                        type="button"
                                        onClick={handleRemoveAvatar}
                                        disabled={avatarBusy}
                                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
                                    >
                                        <Trash2 size={15} />
                                        {removingAvatar ? 'Removing...' : 'Remove'}
                                    </button>
                                )}
                            </div>
                        </div>

                        <p className="mt-4 text-xs text-slate-500">
                            Photo: JPG, PNG or WebP, up to 2 MB.
                        </p>

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={handleAvatarUpload}
                            className="hidden"
                        />
                    </div>
                </section>

                {/* Name */}
                <section className={SECTION_CLASS} aria-labelledby="profile-name-heading">
                    <SectionHeading
                        id="profile-name-heading"
                        icon={<UserRound size={20} />}
                        title="Your name"
                        description="Shown to your teammates on tasks, comments and activity."
                    />

                    <form onSubmit={handleSaveName} className="flex flex-col gap-3 sm:flex-row sm:items-end">
                        <div className="flex-1">
                            <label htmlFor="profile-name" className={LABEL_CLASS}>
                                Full name
                            </label>
                            <input
                                id="profile-name"
                                autoComplete="name"
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="Enter your full name"
                                maxLength={100}
                                required
                                className={INPUT_CLASS}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={savingName || !nameChanged}
                            className={PRIMARY_BUTTON_CLASS}
                        >
                            {savingName ? (
                                <LoaderCircle size={16} className="animate-spin" />
                            ) : (
                                <Save size={16} />
                            )}
                            {savingName ? 'Saving...' : 'Save name'}
                        </button>
                    </form>
                </section>

                {/* Email */}
                <section className={SECTION_CLASS} aria-labelledby="profile-email-heading">
                    <SectionHeading
                        id="profile-email-heading"
                        icon={<Mail size={20} />}
                        title="Email address"
                        description={<>You sign in with <span className="text-slate-200">{profile?.email}</span>.</>}
                    />

                    <form onSubmit={handleChangeEmail} className="space-y-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                            <div className="flex-1">
                                <label htmlFor="profile-new-email" className={LABEL_CLASS}>
                                    New email address
                                </label>
                                <input
                                    id="profile-new-email"
                                    autoComplete="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="name@example.com"
                                    required
                                    className={INPUT_CLASS}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={changingEmail || !emailChanged}
                                className={PRIMARY_BUTTON_CLASS}
                            >
                                {changingEmail ? (
                                    <LoaderCircle size={16} className="animate-spin" />
                                ) : (
                                    <Mail size={16} />
                                )}
                                {changingEmail ? 'Sending...' : 'Change email'}
                            </button>
                        </div>

                        <p className="text-xs leading-5 text-slate-400">
                            We'll email you a confirmation link. Your address only changes after you confirm it.
                        </p>
                    </form>
                </section>

                {/* Password */}
                <section className={SECTION_CLASS} aria-labelledby="profile-password-heading">
                    <SectionHeading
                        id="profile-password-heading"
                        icon={<LockKeyhole size={20} />}
                        title="Password"
                        description="Use a password you don't use anywhere else."
                    />

                    <form onSubmit={handleChangePassword} className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <label htmlFor="profile-new-password" className={LABEL_CLASS}>
                                    New password
                                </label>
                                <PasswordInput
                                    id="profile-new-password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="New password"
                                    minLength={8}
                                    autoComplete="new-password"
                                    required
                                    aria-describedby="profile-password-rules"
                                    className="border-slate-700 bg-slate-950 text-white focus:border-indigo-500"
                                />
                            </div>

                            <div>
                                <label htmlFor="profile-confirm-password" className={LABEL_CLASS}>
                                    Confirm new password
                                </label>
                                <PasswordInput
                                    id="profile-confirm-password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Type it again"
                                    minLength={8}
                                    autoComplete="new-password"
                                    required
                                    aria-describedby="profile-password-rules"
                                    className="border-slate-700 bg-slate-950 text-white focus:border-indigo-500"
                                />
                            </div>
                        </div>

                        <ul id="profile-password-rules" className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
                            <PasswordRule met={passwordLongEnough}>At least 8 characters</PasswordRule>
                            <PasswordRule met={passwordsMatch}>Passwords match</PasswordRule>
                        </ul>

                        <button
                            type="submit"
                            disabled={changingPassword || !passwordLongEnough || !passwordsMatch}
                            className={PRIMARY_BUTTON_CLASS}
                        >
                            {changingPassword ? (
                                <LoaderCircle size={16} className="animate-spin" />
                            ) : (
                                <ShieldCheck size={16} />
                            )}
                            {changingPassword ? 'Updating...' : 'Change password'}
                        </button>
                    </form>
                </section>

                {/* Sign out */}
                <section className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                    <div>
                        <h2 className="font-semibold">Sign out</h2>
                        <p className="mt-1 text-sm text-slate-400">End your session on this device.</p>
                    </div>
                    <button
                        type="button"
                        onClick={handleLogout}
                        className="flex items-center justify-center gap-2 rounded-lg border border-slate-700 px-4 py-2.5 text-sm transition hover:bg-slate-800"
                    >
                        <LogOut size={16} />
                        Sign out
                    </button>
                </section>

            </div>
        </div>
    )
}

const SECTION_CLASS = 'mb-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl shadow-black/20 sm:p-6'
const LABEL_CLASS = 'mb-2 block text-sm font-medium text-slate-300'
const INPUT_CLASS = 'w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition hover:border-slate-600 focus:border-indigo-500'
const PRIMARY_BUTTON_CLASS = 'flex shrink-0 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-3 text-sm font-medium shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500 disabled:shadow-none'

function SectionHeading({ id, icon, title, description }: { id: string; icon: ReactNode; title: string; description: ReactNode }) {
    return (
        <div className="mb-5 flex items-start gap-3">
            <span className="mt-0.5 rounded-lg bg-indigo-500/10 p-2 text-indigo-300">{icon}</span>
            <div className="min-w-0">
                <h2 id={id} className="text-lg font-semibold">{title}</h2>
                <p className="mt-0.5 break-words text-sm text-slate-400">{description}</p>
            </div>
        </div>
    )
}

function PasswordRule({ met, children }: { met: boolean; children: ReactNode }) {
    return (
        <li className={`flex items-center gap-1.5 transition ${met ? 'text-green-400' : 'text-slate-500'}`}>
            {met ? <Check size={14} /> : <Circle size={10} className="mx-0.5" />}
            {children}
            <span className="sr-only">{met ? '(done)' : '(not yet)'}</span>
        </li>
    )
}

export default ProfileSettings
