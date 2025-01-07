import { useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import styles from '@/styles/Auth.module.css';

// Function to convert Firebase error codes to user-friendly messages
const getErrorMessage = (error: any): string => {
  const errorCode = error?.code || '';
  const errorMessage = error?.message || '';

  const errorMap: { [key: string]: string } = {
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/user-disabled': 'This account has been disabled. Please contact support.',
    'auth/user-not-found': 'No account found with this email. Please check your email or sign up.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/too-many-requests': 'Too many failed login attempts. Please try again later.',
    'auth/network-request-failed': 'Network error. Please check your internet connection.',
    'auth/internal-error': 'Something went wrong. Please try again.',
    'auth/invalid-login-credentials': 'Invalid email or password. Please try again.',
    'auth/invalid-credential': 'Invalid email or password. Please try again.',
  };

  // First try to match the error code
  if (errorMap[errorCode]) {
    return errorMap[errorCode];
  }

  // Return a generic error with debugging information
  return `An error occurred while signing in. Please try again. (${errorCode}: ${errorMessage})`;
};

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await signIn(email, password);
      router.push('/');
    } catch (error: any) {
      console.log(error.error);
      setError(getErrorMessage(error));
    }

    setIsLoading(false);
  }

  return (
    <div className={styles.authContainer}>
      <div className={styles.authCard}>
        <h1>Sign In</h1>
        {error && <div className={styles.error}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className={styles.formGroup}>
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className={styles.submitButton}
          >
            {isLoading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>
        <div className={styles.links}>
          <a href="/signup">Need an account? Sign Up</a>
        </div>
      </div>
    </div>
  );
} 