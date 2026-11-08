import { supabase } from './supabase'
import { getCurrentUser } from './auth'
import type { Profile } from '../types/app'

export type MyProfile = Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'created_at' | 'updated_at'> & {
    email: string | undefined
}

// Work out the storage path of an avatar from its public URL.
// Returns null if the URL is not a file in this user's avatar folder.
function getAvatarPathFromUrl(avatarUrl: string | null | undefined, userId: string): string | null {
    if (!avatarUrl) return null

    const marker = '/storage/v1/object/public/avatars/'
    const markerIndex = avatarUrl.indexOf(marker)

    if (markerIndex === -1) return null

    const filePath = decodeURIComponent(
        avatarUrl.slice(markerIndex + marker.length).split('?')[0] ?? ''
    )

    return filePath.startsWith(`${userId}/`) ? filePath : null
}

// Fetch the current user's profile
export async function getMyProfile(): Promise<MyProfile> {
    const user = await getCurrentUser()

    const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, created_at, updated_at')
        .eq('id', user.id)
        .single()

    if (error) throw new Error(error.message)

    return {
        ...data,
        email: user.email,
    }
}

// Update the user's full name
export async function updateMyProfile(fullName: string): Promise<Profile> {
    const user = await getCurrentUser()
    const trimmedName = fullName?.trim()

    if (!trimmedName) {
        throw new Error('Full name is required.')
    }

    const { data, error } = await supabase
        .from('profiles')
        .update({
            full_name: trimmedName,
            updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
        .select()
        .single()

    if (error) throw new Error(error.message)

    return data
}

// Upload a profile avatar
export async function uploadMyAvatar(file: File): Promise<string> {
    const user = await getCurrentUser()

    if (!file) throw new Error('Please select an image.')

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']

    if (!allowedTypes.includes(file.type)) {
        throw new Error('Only JPG, PNG and WebP images are allowed.')
    }

    if (file.size > 2 * 1024 * 1024) {
        throw new Error('Image size must be less than 2 MB.')
    }

    // Remember the current avatar so it can be cleaned up after the swap.
    const { data: currentProfile } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .single()

    const previousAvatarPath = getAvatarPathFromUrl(
        currentProfile?.avatar_url,
        user.id
    )

    const extension = (file.type.split('/')[1] ?? 'jpg').replace('jpeg', 'jpg')
    const filePath = `${user.id}/avatar-${Date.now()}.${extension}`

    const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type,
        })

    if (uploadError) throw new Error(uploadError.message)

    const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

    const avatarUrl = publicUrlData.publicUrl

    const { error: profileError } = await supabase
        .from('profiles')
        .update({
            avatar_url: avatarUrl,
            updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

    if (profileError) {
        await supabase.storage.from('avatars').remove([filePath])
        throw new Error(profileError.message)
    }

    // Delete the old file so storage does not fill up with unused images.
    // A failure here is not fatal: the new avatar is already saved.
    if (previousAvatarPath && previousAvatarPath !== filePath) {
        const { error: cleanupError } = await supabase.storage
            .from('avatars')
            .remove([previousAvatarPath])

        if (cleanupError) {
            console.warn('Unable to delete previous avatar:', cleanupError.message)
        }
    }

    return avatarUrl
}

// Remove the current user's avatar
export async function removeMyAvatar(): Promise<true> {
    const user = await getCurrentUser()

    const { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .single()

    if (fetchError) throw new Error(fetchError.message)

    if (!profile.avatar_url) return true

    const filePath = getAvatarPathFromUrl(profile.avatar_url, user.id)

    // Clear the profile first. If this fails, the image is still intact,
    // so the profile never points at a deleted file.
    const { error: updateError } = await supabase
        .from('profiles')
        .update({
            avatar_url: null,
            updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

    if (updateError) throw new Error(updateError.message)

    if (filePath) {
        const { error: deleteError } = await supabase.storage
            .from('avatars')
            .remove([filePath])

        if (deleteError) {
            console.warn('Unable to delete avatar file:', deleteError.message)
        }
    }

    return true
}

// Change the user's email address
export async function updateMyEmail(newEmail: string) {
    const user = await getCurrentUser()
    const trimmedEmail = newEmail?.trim().toLowerCase()

    if (!trimmedEmail) {
        throw new Error('Email address is required.')
    }

    if (trimmedEmail === user.email?.toLowerCase()) {
        throw new Error('This is already your current email address.')
    }

    const { data, error } = await supabase.auth.updateUser({
        email: trimmedEmail,
    })

    if (error) throw new Error(error.message)

    return data
}

// Change the user's password
export async function updateMyPassword(newPassword: string) {
    await getCurrentUser()

    if (!newPassword || newPassword.length < 8) {
        throw new Error('Password must contain at least 8 characters.')
    }

    const { data, error } = await supabase.auth.updateUser({
        password: newPassword,
    })

    if (error) throw new Error(error.message)

    return data
}
