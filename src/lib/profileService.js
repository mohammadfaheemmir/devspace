
import { supabase } from './supabase'

// Get the currently logged-in user
async function getCurrentUser() {
    const {
        data: { user },
        error,
    } = await supabase.auth.getUser()

    if (error) throw new Error(error.message)
    if (!user) throw new Error('Please log in to continue.')

    return user
}

// Fetch the current user's profile
export async function getMyProfile() {
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
export async function updateMyProfile(fullName) {
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
export async function uploadMyAvatar(file) {
    const user = await getCurrentUser()

    if (!file) throw new Error('Please select an image.')

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']

    if (!allowedTypes.includes(file.type)) {
        throw new Error('Only JPG, PNG and WebP images are allowed.')
    }

    if (file.size > 2 * 1024 * 1024) {
        throw new Error('Image size must be less than 2 MB.')
    }

    const extension = file.type.split('/')[1].replace('jpeg', 'jpg')
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

    return avatarUrl
}

// Remove the current user's avatar
export async function removeMyAvatar() {
    const user = await getCurrentUser()

    const { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .single()

    if (fetchError) throw new Error(fetchError.message)

    if (!profile.avatar_url) return true

    const marker = '/storage/v1/object/public/avatars/'
    const markerIndex = profile.avatar_url.indexOf(marker)

    if (markerIndex === -1) {
        throw new Error('Could not identify the stored avatar file.')
    }

    const filePath = decodeURIComponent(
        profile.avatar_url.slice(markerIndex + marker.length).split('?')[0]
    )

    if (!filePath.startsWith(`${user.id}/`)) {
        throw new Error('Avatar path does not belong to your account.')
    }

    const { error: deleteError } = await supabase.storage
        .from('avatars')
        .remove([filePath])

    if (deleteError) throw new Error(deleteError.message)

    const { error: updateError } = await supabase
        .from('profiles')
        .update({
            avatar_url: null,
            updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

    if (updateError) throw new Error(updateError.message)

    return true
}

// Change the user's email address
export async function updateMyEmail(newEmail) {
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
export async function updateMyPassword(newPassword) {
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
