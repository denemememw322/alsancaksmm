import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Mail, Lock, ArrowRight, AlertCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { AuthShell, Field, Spinner } from './SignIn';

export default function SignUp() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    const { error } = await signUp(email, password, username);
    setLoading(false);
    if (error) setError(error);
    else navigate('/dashboard');
  };

  return (
    <AuthShell title="Create your account" subtitle="Start growing your social media today">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-error-500/10 border border-error-500/20 text-error-400 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <Field icon={User} label="Username" type="text" value={username} onChange={setUsername} placeholder="yourname" />
        <Field icon={Mail} label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" />
        <Field icon={Lock} label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••" />
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
        >
          {loading ? <Spinner /> : <>Create account <ArrowRight className="w-4 h-4" /></>}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-text-secondary">
        Already have an account?{' '}
        <Link to="/signin" className="text-brand-400 hover:text-brand-300 font-medium">Sign in</Link>
      </p>
    </AuthShell>
  );
}
