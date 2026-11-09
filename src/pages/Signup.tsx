
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import PasswordInput from '../components/PasswordInput'

function Signup() {
    const { signup } = useAuth()
    const navigate = useNavigate()

    const [fullName, setFullName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSignup = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setError('')
        setMessage('')

        if (password.length < 8) {
            setError('Password must contain at least 8 characters.')
            return
        }

        setLoading(true)

        const { data, error } = await signup(fullName, email, password)

        setLoading(false)

        if (error) {
            setError(error.message)
            return
        }

        if (data.session) {
            navigate('/dashboard')
        } else {
            setMessage('Account created! Please check your email to confirm your account.')
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center px-4 py-10 text-white">
            <div className="w-full max-w-md">
                <Link to="/" className="block text-center text-2xl font-bold tracking-tight">
                    Dev<span className="text-indigo-400">Space</span>
                </Link>

                <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl shadow-black/20 backdrop-blur sm:p-8">
                    <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Create your account</h1>
                    <p className="mt-2 text-slate-400">
                        Start managing your projects with your team.
                    </p>

                    <form onSubmit={handleSignup} className="mt-8 space-y-5">
                        <div>
                            <label htmlFor="signup-name" className="mb-2 block text-sm text-slate-300">
                                Full name
                            </label>
                            <input
                                id="signup-name"
                                autoComplete="name"
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="Your full name"
                                required
                                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 outline-none transition focus:border-indigo-400"
                            />
                        </div>

                        <div>
                            <label htmlFor="signup-email" className="mb-2 block text-sm text-slate-300">
                                Email address
                            </label>
                            <input
                                id="signup-email"
                                autoComplete="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                required
                                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 outline-none transition focus:border-indigo-400"
                            />
                        </div>

                        <div>
                            <label htmlFor="signup-password" className="mb-2 block text-sm text-slate-300">
                                Password
                            </label>
                            <PasswordInput
                                id="signup-password"
                                autoComplete="new-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Create a password"
                                minLength={8}
                                required
                                aria-describedby="signup-password-hint"
                            />
                            <p
                                id="signup-password-hint"
                                className={`mt-2 text-xs transition ${password.length >= 8 ? 'text-green-400' : 'text-slate-400'}`}
                            >
                                {password.length >= 8 ? 'âœ“ ' : ''}At least 8 characters
                            </p>
                        </div>

                        {error && (
                            <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                                {error}
                            </p>
                        )}

                        {message && (
                            <p role="status" className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
                                {message}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full rounded-xl bg-indigo-600 py-3 font-medium shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {loading ? 'Creating account...' : 'Create account'}
                        </button>
                    </form>

                    <p className="mt-6 text-center text-sm text-slate-400">
                        Already have an account?{' '}
                        <Link to="/login" className="font-semibold text-indigo-400 hover:text-indigo-300">
                            Login
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    )
}

export default Signup
