import { useEffect, useState } from 'react';
import { useSearchParams, useLocation, Link, useNavigate } from 'react-router-dom';
import { verifyEmailApi, resendVerificationApi } from '../api/auth.js';
import { useAuthStore } from '../stores/auth.store.js';
import { HarmoniumLogo } from '../components/shared/HarmoniumLogo.js';
import { LoadingSpinner } from '../components/shared/LoadingSpinner.js';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const loginWithAuthResponse = useAuthStore((s) => s.loginWithAuthResponse);

  const token = searchParams.get('token');
  const emailFromState = (location.state as { email?: string } | null)?.email;

  const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [resendEmail, setResendEmail] = useState(emailFromState ?? '');

  useEffect(() => {
    if (!token) return;

    setStatus('verifying');
    verifyEmailApi(token)
      .then((response) => {
        setStatus('success');
        loginWithAuthResponse(response);
        setTimeout(() => navigate('/channels/@me', { replace: true }), 1500);
      })
      .catch((err) => {
        setStatus('error');
        setErrorMessage(err.response?.data?.message ?? 'Verification failed. The link may be invalid or expired.');
      });
  }, [token, loginWithAuthResponse, navigate]);

  const handleResend = async () => {
    if (!resendEmail.trim()) return;
    setResendStatus('sending');
    try {
      await resendVerificationApi(resendEmail.trim());
      setResendStatus('sent');
    } catch {
      setResendStatus('idle');
    }
  };

  // Token verification mode
  if (token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-th-bg-tertiary p-4">
        <div className="w-full max-w-md rounded-lg bg-th-bg-primary p-8 shadow-lg text-center">
          <HarmoniumLogo size={72} className="mx-auto mb-6 text-th-brand" animate />

          {status === 'verifying' && (
            <>
              <LoadingSpinner size={32} className="mx-auto mb-4 text-th-brand" />
              <h1 className="text-xl font-bold text-th-text-primary">Verifying your email...</h1>
            </>
          )}

          {status === 'success' && (
            <>
              <h1 className="text-xl font-bold text-th-text-primary mb-2">Email verified!</h1>
              <p className="text-th-text-secondary">Redirecting you to Harmonium...</p>
            </>
          )}

          {status === 'error' && (
            <>
              <h1 className="text-xl font-bold text-th-text-primary mb-2">Verification failed</h1>
              <p className="text-red-400 text-sm mb-4">{errorMessage}</p>
              <div className="space-y-3">
                <div>
                  <input
                    type="email"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full rounded border border-th-border-strong bg-th-bg-tertiary px-3 py-2 text-th-text-primary outline-none focus:border-th-brand transition-colors text-sm"
                  />
                </div>
                {resendStatus === 'sent' ? (
                  <p className="text-green-400 text-sm">New verification email sent! Check your inbox.</p>
                ) : (
                  <button
                    onClick={handleResend}
                    disabled={resendStatus === 'sending' || !resendEmail.trim()}
                    className="w-full rounded py-2 font-medium text-white bg-th-brand hover:bg-th-brand-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                  >
                    {resendStatus === 'sending' ? 'Sending...' : 'Resend verification email'}
                  </button>
                )}
                <Link to="/login" className="block text-sm text-th-brand hover:underline">
                  Back to login
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Check your email mode (no token)
  return (
    <div className="flex min-h-screen items-center justify-center bg-th-bg-tertiary p-4">
      <div className="w-full max-w-md rounded-lg bg-th-bg-primary p-8 shadow-lg text-center">
        <HarmoniumLogo size={72} className="mx-auto mb-6 text-th-brand" animate />

        <h1 className="text-2xl font-bold text-th-text-primary mb-2">Check your email</h1>
        <p className="text-th-text-secondary mb-1">
          We sent a verification link to
        </p>
        {emailFromState && (
          <p className="text-th-text-primary font-medium mb-6">{emailFromState}</p>
        )}
        {!emailFromState && (
          <p className="text-th-text-secondary mb-6">your email address.</p>
        )}

        <p className="text-th-text-secondary text-sm mb-6">
          Click the link in the email to verify your account. The link expires in 24 hours.
        </p>

        <div className="space-y-3">
          {resendStatus === 'sent' ? (
            <p className="text-green-400 text-sm">New verification email sent! Check your inbox.</p>
          ) : (
            <>
              {!emailFromState && (
                <input
                  type="email"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full rounded border border-th-border-strong bg-th-bg-tertiary px-3 py-2 text-th-text-primary outline-none focus:border-th-brand transition-colors text-sm mb-2"
                />
              )}
              <button
                onClick={handleResend}
                disabled={resendStatus === 'sending' || !resendEmail.trim()}
                className="w-full rounded py-2 font-medium text-th-text-primary bg-th-bg-tertiary hover:bg-th-bg-secondary border border-th-border-strong disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
              >
                {resendStatus === 'sending' ? 'Sending...' : "Didn't receive it? Resend"}
              </button>
            </>
          )}
          <Link to="/login" className="block text-sm text-th-brand hover:underline">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
