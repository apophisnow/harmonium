import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store.js';
import { LoadingSpinner } from '../shared/LoadingSpinner.js';
import { AxiosError } from 'axios';

export function RegisterForm() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const register = useAuthStore((s) => s.register);
  const navigate = useNavigate();

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!username.trim()) {
      newErrors.username = 'Username is required';
    } else if (username.trim().length < 2 || username.trim().length > 32) {
      newErrors.username = 'Username must be between 2 and 32 characters';
    }

    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setGeneralError('');

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await register(username.trim(), email.trim(), password);
      navigate('/channels/@me');
    } catch (err) {
      if (err instanceof AxiosError && err.response?.data?.message) {
        setGeneralError(err.response.data.message);
      } else {
        setGeneralError('Registration failed. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-lg bg-[#36393f] p-8 shadow-lg">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-[#dcddde]">Create an account</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {generalError && (
          <div className="rounded bg-red-500/10 p-3 text-sm text-red-400">
            {generalError}
          </div>
        )}

        <div>
          <label
            htmlFor="username"
            className="mb-2 block text-xs font-bold uppercase text-[#96989d]"
          >
            Username <span className="text-red-400">*</span>
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded border border-[#040405] bg-[#202225] px-3 py-2 text-[#dcddde] outline-none focus:border-[#5865f2] transition-colors"
            autoComplete="username"
            disabled={isSubmitting}
          />
          {errors.username && (
            <p className="mt-1 text-xs text-red-400">{errors.username}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="email"
            className="mb-2 block text-xs font-bold uppercase text-[#96989d]"
          >
            Email <span className="text-red-400">*</span>
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-[#040405] bg-[#202225] px-3 py-2 text-[#dcddde] outline-none focus:border-[#5865f2] transition-colors"
            autoComplete="email"
            disabled={isSubmitting}
          />
          {errors.email && (
            <p className="mt-1 text-xs text-red-400">{errors.email}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-2 block text-xs font-bold uppercase text-[#96989d]"
          >
            Password <span className="text-red-400">*</span>
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-[#040405] bg-[#202225] px-3 py-2 text-[#dcddde] outline-none focus:border-[#5865f2] transition-colors"
            autoComplete="new-password"
            disabled={isSubmitting}
          />
          {errors.password && (
            <p className="mt-1 text-xs text-red-400">{errors.password}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex w-full items-center justify-center rounded py-2.5 font-medium text-white bg-[#5865f2] hover:bg-[#4752c4] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? <LoadingSpinner size={20} /> : 'Continue'}
        </button>

        <p className="mt-2 text-sm text-[#96989d]">
          Already have an account?{' '}
          <Link to="/login" className="text-[#5865f2] hover:underline">
            Login
          </Link>
        </p>
      </form>
    </div>
  );
}
