
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function Signup() {
    const { signup } = useAuth()
    const navigate = useNavigate()

    const [fullName, setFullName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSignup = async (e) => {
        e.preventDefault()
        setError('')
        setMessage('')

        if (password.length < 6) {
            setError('Password must contain at least 6 characters.')
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
        <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-10 text-white">
            <div className="w-full max-w-md">
                <Link to="/" className="text-2xl font-bold tracking-tight">
                    Dev<span className="text-indigo-400">Space</span>
                </Link>

                <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
                    <h1 className="text-3xl font-bold">Create your account</h1>
                    <p className="mt-2 text-slate-400">
                        Start managing your projects with your team.
                    </p>

                    <form onSubmit={handleSignup} className="mt-8 space-y-5">
                        <div>
                            <label className="mb-2 block text-sm text-slate-300">
                                Full name
                            </label>
                            <input
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="Your full name"
                                required
                                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 outline-none focus:border-indigo-400"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm text-slate-300">
                                Email address
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                required
                                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 outline-none focus:border-indigo-400"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm text-slate-300">
                                Password
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="At least 6 characters"
                                minLength={6}
                                required
                                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 outline-none focus:border-indigo-400"
                            />
                        </div>

                        {error && (
                            <p className="text-sm text-red-400">{error}</p>
                        )}

                        {message && (
                            <p className="text-sm text-green-400">{message}</p>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full rounded-lg bg-indigo-500 py-3 font-semibold transition hover:bg-indigo-600 disabled:opacity-50"
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
