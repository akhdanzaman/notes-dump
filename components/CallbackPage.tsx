import React, { useEffect, useState } from 'react';

const CallbackPage: React.FC = () => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const exchangeCode = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');

        if (!code) {
          throw new Error('No authorization code found in URL');
        }

        const response = await fetch('/api/auth/google/exchange', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code, state }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to exchange code');
        }

        const tokens = await response.json();

        if (window.opener) {
          window.opener.postMessage({ type: 'GOOGLE_OAUTH_SUCCESS', tokens }, window.location.origin);
          setStatus('success');
          // Optional: close the window automatically after a short delay
          setTimeout(() => window.close(), 1500);
        } else {
          // If not opened in a popup, save tokens and redirect
          localStorage.setItem('braindump_google_session', JSON.stringify({
            ...tokens,
            expires_at: Date.now() + ((tokens.expires_in || 3600) * 1000),
          }));
          window.location.href = '/';
        }
      } catch (error: any) {
        console.error('OAuth exchange error:', error);
        setStatus('error');
        setErrorMessage(error.message || 'An unknown error occurred');
        
        if (window.opener) {
          window.opener.postMessage({ type: 'GOOGLE_OAUTH_ERROR', error: error.message }, window.location.origin);
        }
      }
    };

    exchangeCode();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-primary">
      <div className="max-w-md w-full p-8 bg-surface rounded-2xl shadow-xl border border-border text-center">
        {status === 'loading' && (
          <>
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold mb-2">Authenticating...</h2>
            <p className="text-muted">Please wait while we complete the sign-in process.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold mb-2">Authentication Successful!</h2>
            <p className="text-muted">You can now close this window and return to the app.</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold mb-2">Authentication Failed</h2>
            <p className="text-red-500 mb-4">{errorMessage}</p>
            <button 
              onClick={() => window.location.href = '/'}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-500 transition-colors"
            >
              Return to App
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default CallbackPage;
