import { useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import styles from '@/styles/Auth.module.css';

// Function to convert Firebase error codes to user-friendly messages
const getErrorMessage = (error: any): string => {
  const errorCode = error?.code || '';
  const errorMessage = error?.message || '';

  const errorMap: { [key: string]: string } = {
    'auth/email-already-in-use': 'An account with this email already exists. Please sign in instead.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/operation-not-allowed': 'Account creation is currently disabled. Please contact support.',
    'auth/weak-password': 'Password is too weak. Please choose a stronger password.',
    'auth/network-request-failed': 'Network error. Please check your internet connection.',
    'auth/internal-error': 'Something went wrong. Please try again.',
    'auth/invalid-credential': 'Please check your email and password.',
    'passwords-dont-match': 'Passwords do not match. Please try again.',
    'password-too-short': 'Password must be at least 6 characters long.'
  };

  // First try to match the error code
  if (errorMap[errorCode]) {
    return errorMap[errorCode];
  }

  // Return a generic error with debugging information
  return `An error occurred while creating your account. Please try again. (${errorCode}: ${errorMessage})`;
};

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signUp } = useAuth();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      return setError(getErrorMessage({ code: 'passwords-dont-match' }));
    }

    if (password.length < 6) {
      return setError(getErrorMessage({ code: 'password-too-short' }));
    }

    setIsLoading(true);

    try {
      await signUp(email, password);
      router.push('/');
    } catch (error: any) {
      setError(getErrorMessage(error));
    }

    setIsLoading(false);
  }

  return (
    <div className={styles.authContainer}>
      <div className={styles.authCard}>
        <h1>Sign Up</h1>
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
          <div className={styles.formGroup}>
            <label>Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className={styles.submitButton}
          >
            {isLoading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>
        <div className={styles.links}>
          <a href="/login">Already have an account? Sign In</a>
        </div>
      </div>
    </div>
  );
} 