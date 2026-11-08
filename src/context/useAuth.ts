import { createContext, useContext } from 'react'
import type { AuthError, AuthResponse, User } from '@supabase/supabase-js'

export type AuthContextValue = {
    user: User | null
    loading: boolean
    signup: (fullName: string, email: string, password: string) => Promise<AuthResponse>
    login: (email: string, password: string) => Promise<AuthResponse>
    logout: () => Promise<{ error: AuthError | null }>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
    const context = useContext(AuthContext)

    if (!context) {
        throw new Error('useAuth must be used inside <AuthProvider>.')
    }

    return context
}
