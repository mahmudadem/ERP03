import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from 'react-i18next';

export const LoginPage: React.FC = () => {
  const { t } = useTranslation('common');
  const { login, user, loading: authLoading } = useAuth();
  const location = useLocation() as any;
  const redirectTo = location.state?.from?.pathname || '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already authenticated, bounce to the app shell
  if (!authLoading && user) {
    return <Navigate to={redirectTo} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await login({ email, password });
      // Navigation/Redirect will be handled by the parent or router based on auth state
    } catch (err: any) {
      console.error('Login failed', err);
      // Firebase auth errors usually have a code, but we'll show a generic or message if available
      setError(err.message || t('auth.login.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh', 
      flexDirection: 'column' 
    }}>
      <div style={{ 
        padding: '2rem', 
        border: '1px solid #ccc', 
        borderRadius: '8px', 
        width: '100%', 
        maxWidth: '400px' 
      }}>
        <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>{t('auth.login.title')}</h2>
        
        {error && (
          <div style={{ 
            color: 'red', 
            marginBottom: '1rem', 
            padding: '0.5rem', 
            backgroundColor: '#ffebee', 
            borderRadius: '4px' 
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label 
              htmlFor="email" 
              style={{ display: 'block', marginBottom: '0.5rem' }}
            >
              {t('auth.login.email')}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ 
                width: '100%', 
                padding: '0.5rem', 
                borderRadius: '4px', 
                border: '1px solid #ccc' 
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label 
              htmlFor="password" 
              style={{ display: 'block', marginBottom: '0.5rem' }}
            >
              {t('auth.login.password')}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ 
                width: '100%', 
                padding: '0.5rem', 
                borderRadius: '4px', 
                border: '1px solid #ccc' 
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.75rem',
              backgroundColor: loading ? '#ccc' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '1rem'
            }}
          >
            {loading ? t('auth.login.loggingIn') : t('auth.login.submit')}
          </button>
        </form>
      </div>
    </div>
  );
};
