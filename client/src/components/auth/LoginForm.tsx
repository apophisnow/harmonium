import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store.js';
import { LoadingSpinner } from '../shared/LoadingSpinner.js';
import { AxiosError } from 'axios';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    if (!password) {
      setError('Password is required');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate('/channels/@me');
    } catch (err) {
      if (err instanceof AxiosError && err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError('Login failed. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-lg bg-th-bg-primary p-8 shadow-lg">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-th-text-primary">Welcome back!</h1>
        <p className="mt-2 text-th-text-secondary">We're so excited to see you again!</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded bg-red-500/10 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div>
          <label
            htmlFor="email"
            className="mb-2 block text-xs font-bold uppercase text-th-text-secondary"
          >
            Email <span className="text-red-400">*</span>
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-th-border-strong bg-th-bg-tertiary px-3 py-2 text-th-text-primary outline-none focus:border-th-brand transition-colors"
            autoComplete="email"
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-2 block text-xs font-bold uppercase text-th-text-secondary"
          >
            Password <span className="text-red-400">*</span>
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-th-border-strong bg-th-bg-tertiary px-3 py-2 text-th-text-primary outline-none focus:border-th-brand transition-colors"
            autoComplete="current-password"
            disabled={isSubmitting}
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex w-full items-center justify-center rounded py-2.5 font-medium text-white bg-th-brand hover:bg-th-brand-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? <LoadingSpinner size={20} /> : 'Log In'}
        </button>

        <p className="mt-2 text-sm text-th-text-secondary">
          Need an account?{' '}
          <Link to="/register" className="text-th-brand hover:underline">
            Register
          </Link>
        </p>
      </form>
    </div>
  );
}
