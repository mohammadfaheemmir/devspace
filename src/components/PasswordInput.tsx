import { useState, type InputHTMLAttributes } from 'react'
import { Eye, EyeOff } from 'lucide-react'

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

const DEFAULT_CLASSES = 'border-slate-700 bg-slate-800 focus:border-indigo-400'

// Password field with a show/hide toggle. `className` replaces the default
// border/background/focus colours (layout and padding stay the same).
function PasswordInput({ className = DEFAULT_CLASSES, ...props }: PasswordInputProps) {
    const [visible, setVisible] = useState(false)

    return (
        <div className="relative">
            <input
                {...props}
                type={visible ? 'text' : 'password'}
                className={`w-full rounded-lg border py-3 pl-4 pr-12 outline-none transition ${className}`}
            />
            <button
                type="button"
                onClick={() => setVisible((value) => !value)}
                aria-label={visible ? 'Hide password' : 'Show password'}
                aria-pressed={visible}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-slate-400 transition hover:text-white"
            >
                {visible ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
        </div>
    )
}

export default PasswordInput
