import { supabase } from './supabase'

// Return the signed-in user, or throw if nobody is signed in.
//
// This reads the locally stored session (refreshing the token if it has
// expired) instead of calling the Auth server on every request. That is
// safe because Supabase verifies the access token on every database and
// storage request, and Row Level Security decides what the user can do.
export async function getCurrentUser() {
    const { data, error } = await supabase.auth.getSession()

    if (error) {
        throw new Error(`Authentication error: ${error.message}`)
    }

    const user = data.session?.user

    if (!user) {
        throw new Error('Please log in to continue.')
    }

    return user
}
