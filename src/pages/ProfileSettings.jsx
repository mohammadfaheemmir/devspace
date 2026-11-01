
import { useEffect, useRef, useState } from 'react'
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
} from 'lucide-react'

import {
    getMyProfile,
    updateMyProfile,
    uploadMyAvatar,
    removeMyAvatar,
    updateMyEmail,
    updateMyPassword,
} from '../lib/profileService'

function ProfileSettings() {
    const navigate = useNavigate()
    const fileInputRef = useRef(null)

    const [profile, setProfile] = useState(null)
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

    const [message, setMessage] = useState('')
    const [error, setError] = useState('')

    useEffect(() => {
        async function loadProfile() {
            try {
                const data = await getMyProfile()

                setProfile(data)
                setFullName(data.full_name || '')
                setEmail(data.email || '')
            } catch (err) {
                setError(err.message || 'Unable to load your profile.')
            } finally {
                setLoading(false)
            }
        }

        loadProfile()
    }, [])

    function showMessage(text) {
        setError('')
        setMessage(text)
    }

    function showError(text) {
        setMessage('')
        setError(text)
    }

    async function handleSaveName(e) {
        e.preventDefault()
        setMessage('')
        setError('')

        try {
            setSavingName(true)

            const updatedProfile = await updateMyProfile(fullName)

            setProfile((previous) => ({
                ...previous,
                ...updatedProfile,
            }))

            setFullName(updatedProfile.full_name)
            showMessage('Your profile name has been updated.')
        } catch (err) {
            showError(err.message || 'Unable to update your name.')
        } finally {
            setSavingName(false)
        }
    }

    async function handleAvatarUpload(e) {
        const file = e.target.files?.[0]

        if (!file) return

        setMessage('')
        setError('')

        try {
            setUploadingAvatar(true)

            const avatarUrl = await uploadMyAvatar(file)

            setProfile((previous) => ({
                ...previous,
                avatar_url: avatarUrl,
            }))

            showMessage('Profile picture uploaded successfully.')
        } catch (err) {
            showError(err.message || 'Unable to upload your picture.')
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

        setMessage('')
        setError('')

        try {
            setRemovingAvatar(true)

            await removeMyAvatar()

            setProfile((previous) => ({
                ...previous,
                avatar_url: null,
            }))

            showMessage('Profile picture removed successfully.')
        } catch (err) {
            showError(err.message || 'Unable to remove your picture.')
        } finally {
            setRemovingAvatar(false)
        }
    }

    async function handleChangeEmail(e) {
        e.preventDefault()
        setMessage('')
        setError('')

        try {
            setChangingEmail(true)

            await updateMyEmail(email)

            showMessage(
                'Email change requested. Check your inbox for the verification email and follow its instructions.'
            )
        } catch (err) {
            showError(err.message || 'Unable to update your email.')
        } finally {
            setChangingEmail(false)
        }
    }

    async function handleChangePassword(e) {
        e.preventDefault()
        setMessage('')
        setError('')

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
            showError(err.message || 'Unable to update your password.')
        } finally {
            setChangingPassword(false)
        }
    }

    const displayName =
        profile?.full_name || profile?.email?.split('@')[0] || 'User'

    const initial = displayName.charAt(0).toUpperCase()

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">
                <LoaderCircle className="mr-3 animate-spin" size={22} />
                Loading profile...
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6">
            <div className="mx-auto max-w-3xl">

                {/* Header */}
                <div className="mb-8 flex items-center gap-4">
                    <button
                        type="button"
                        onClick={() => navigate('/dashboard')}
                        className="rounded-lg border border-slate-700 p-2 transition hover:bg-slate-800"
                        aria-label="Back to dashboard"
                    >
                        <ArrowLeft size={20} />
                    </button>

                    <div>
                        <h1 className="text-2xl font-bold">Account Settings</h1>
                        <p className="mt-1 text-sm text-slate-400">
                            Manage your profile and account security.
                        </p>
                    </div>
                </div>

                {/* Status messages */}
                {message && (
                    <div
                        role="status"
                        className="mb-5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300"
                    >
                        {message}
                    </div>
                )}

                {error && (
                    <div
                        role="alert"
                        className="mb-5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
                    >
                        {error}
                    </div>
                )}

                {/* Profile information */}
                <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
                    <div className="mb-6 flex items-center gap-3">
                        <UserRound className="text-indigo-400" size={22} />
                        <div>
                            <h2 className="text-lg font-semibold">Profile Information</h2>
                            <p className="text-sm text-slate-400">
                                Update your public profile details.
                            </p>
                        </div>
                    </div>

                    {/* Avatar */}
                    <div className="mb-7 flex flex-wrap items-center gap-5">
                        <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-slate-700 bg-indigo-600 text-3xl font-bold">
                            {profile?.avatar_url ? (
                                <img
                                    src={profile.avatar_url}
                                    alt="Profile"
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                initial
                            )}
                        </div>

                        <div>
                            <p className="mb-2 font-medium">Profile picture</p>
                            <p className="mb-3 text-xs text-slate-400">
                                JPG, PNG or WebP. Maximum size 2 MB.
                            </p>

                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploadingAvatar || removingAvatar}
                                    className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium transition hover:bg-indigo-500 disabled:opacity-50"
                                >
                                    {uploadingAvatar ? (
                                        <LoaderCircle size={16} className="animate-spin" />
                                    ) : (
                                        <Camera size={16} />
                                    )}
                                    {uploadingAvatar ? 'Uploading...' : 'Upload photo'}
                                </button>

                                {profile?.avatar_url && (
                                    <button
                                        type="button"
                                        onClick={handleRemoveAvatar}
                                        disabled={removingAvatar || uploadingAvatar}
                                        className="flex items-center gap-2 rounded-lg border border-red-500/40 px-4 py-2 text-sm text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
                                    >
                                        {removingAvatar ? (
                                            <LoaderCircle size={16} className="animate-spin" />
                                        ) : (
                                            <Trash2 size={16} />
                                        )}
                                        Remove
                                    </button>
                                )}
                            </div>

                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                onChange={handleAvatarUpload}
                                className="hidden"
                            />
                        </div>
                    </div>

                    {/* Full name */}
                    <form onSubmit={handleSaveName} className="space-y-4">
                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-300">
                                Full name
                            </label>
                            <input
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="Enter your full name"
                                required
                                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-indigo-500"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={savingName}
                            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium transition hover:bg-indigo-500 disabled:opacity-50"
                        >
                            {savingName ? (
                                <LoaderCircle size={16} className="animate-spin" />
                            ) : (
                                <Save size={16} />
                            )}
                            {savingName ? 'Saving...' : 'Save changes'}
                        </button>
                    </form>
                </section>

                {/* Email settings */}
                <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
                    <div className="mb-6 flex items-center gap-3">
                        <Mail className="text-indigo-400" size={22} />
                        <div>
                            <h2 className="text-lg font-semibold">Email Address</h2>
                            <p className="text-sm text-slate-400">
                                Update the email associated with your account.
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handleChangeEmail} className="space-y-4">
                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-300">
                                Current email
                            </label>
                            <input
                                type="email"
                                value={profile?.email || ''}
                                readOnly
                                className="w-full cursor-not-allowed rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-slate-400 outline-none"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-300">
                                New email address
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Enter your new email address"
                                required
                                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-indigo-500"
                            />
                        </div>

                        <p className="text-xs leading-5 text-slate-400">
                            Supabase will send verification email(s) according to your
                            project's email confirmation settings. Your email address
                            may not change until verification is completed.
                        </p>

                        <button
                            type="submit"
                            disabled={changingEmail}
                            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium transition hover:bg-indigo-500 disabled:opacity-50"
                        >
                            {changingEmail ? (
                                <LoaderCircle size={16} className="animate-spin" />
                            ) : (
                                <Mail size={16} />
                            )}
                            {changingEmail ? 'Sending request...' : 'Update email'}
                        </button>
                    </form>
                </section>

                {/* Password settings */}
                <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
                    <div className="mb-6 flex items-center gap-3">
                        <LockKeyhole className="text-indigo-400" size={22} />
                        <div>
                            <h2 className="text-lg font-semibold">Change Password</h2>
                            <p className="text-sm text-slate-400">
                                Choose a strong password for your account.
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handleChangePassword} className="space-y-4">
                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-300">
                                New password
                            </label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Enter new password"
                                minLength={8}
                                autoComplete="new-password"
                                required
                                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-indigo-500"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-300">
                                Confirm new password
                            </label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Confirm new password"
                                minLength={8}
                                autoComplete="new-password"
                                required
                                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-indigo-500"
                            />
                        </div>

                        <p className="text-xs text-slate-400">
                            Your password must contain at least 8 characters.
                        </p>

                        <button
                            type="submit"
                            disabled={changingPassword}
                            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium transition hover:bg-indigo-500 disabled:opacity-50"
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

                <button
                    type="button"
                    onClick={() => navigate('/dashboard')}
                    className="text-sm text-slate-400 transition hover:text-white"
                >
                    <span className="inline-flex items-center gap-2">
                        <ArrowLeft size={16} />
                        Back to dashboard
                    </span>
                </button>

            </div>
        </div>
    )
}

export default ProfileSettings
