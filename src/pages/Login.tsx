
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import PasswordInput from '../components/PasswordInput'

function Login() {
    const { login } = useAuth()
    const navigate = useNavigate()

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        const { error } = await login(email, password)

        setLoading(false)

        if (error) {
            setError(error.message)
            return
        }

        navigate('/dashboard')
    }

    return (
        <div className="min-h-screen flex items-center justify-center px-4 py-10 text-white">
            <div className="w-full max-w-md">
                <Link to="/" className="block text-center text-2xl font-bold tracking-tight">
                    Dev<span className="text-indigo-400">Space</span>
                </Link>

                <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl shadow-black/20 backdrop-blur sm:p-8">
                    <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Welcome back</h1>
                    <p className="mt-2 text-slate-400">
                        Login to continue to your workspace.
                    </p>

                    <form onSubmit={handleLogin} className="mt-8 space-y-5">
                        <div>
                            <label htmlFor="login-email" className="mb-2 block text-sm text-slate-300">
                                Email address
                            </label>
                            <input
                                id="login-email"
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
                            <label htmlFor="login-password" className="mb-2 block text-sm text-slate-300">
                                Password
                            </label>
                            <PasswordInput
                                id="login-password"
                                autoComplete="current-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Your password"
                                required
                            />
                        </div>

                        {error && (
                            <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                                {error}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full rounded-xl bg-indigo-600 py-3 font-medium shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {loading ? 'Logging in...' : 'Login'}
                        </button>
                    </form>

                    <p className="mt-6 text-center text-sm text-slate-400">
                        Don't have an account?{' '}
                        <Link to="/signup" className="font-semibold text-indigo-400 hover:text-indigo-300">
                            Sign up
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    )
}

export default Login
