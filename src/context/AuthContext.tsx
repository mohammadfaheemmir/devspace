import { useEffect, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { AuthContext, type AuthContextValue } from './useAuth'
import { setMonitoringUser } from '../lib/monitoring'

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let active = true

        // Get the existing session when the app loads.
        // Always clear the loading state, even if the request fails,
        // so the app never gets stuck on the loading screen.
        const getSession = async () => {
            try {
                const { data, error } = await supabase.auth.getSession()

                if (error) {
                    console.error('Session error:', error.message)
                }

                if (active) {
                    setUser(data?.session?.user ?? null)
                }
            } catch (err) {
                console.error('Unable to restore session:', err)

                if (active) {
                    setUser(null)
                }
            } finally {
                if (active) {
                    setLoading(false)
                }
            }
        }

        getSession()

        // Listen for login, logout and session changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!active) return

            setUser(session?.user ?? null)
            setLoading(false)
        })

        return () => {
            active = false
            subscription.unsubscribe()
        }
    }, [])

    // Tag error reports with the signed-in user's ID (never their email).
    useEffect(() => {
        setMonitoringUser(user?.id ?? null)
    }, [user?.id])

    // Register a new user
    const signup: AuthContextValue['signup'] = (fullName, email, password) =>
        supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName,
                },
            },
        })

    // Login existing user
    const login: AuthContextValue['login'] = (email, password) =>
        supabase.auth.signInWithPassword({
            email,
            password,
        })

    // Logout current user
    const logout: AuthContextValue['logout'] = async () => {
        const { error } = await supabase.auth.signOut()
        return { error }
    }

    return (
        <AuthContext.Provider
            value={{ user, loading, signup, login, logout }}
        >
            {children}
        </AuthContext.Provider>
    )
}
