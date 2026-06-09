import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axiosInstance from '../utils/axios';
import '../styles/Login.css';

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [authView, setAuthView] = useState('login');
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    resetToken: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const tokenFromUrl = searchParams.get('reset');
    if (tokenFromUrl) {
      setAuthView('reset');
      setFormData((prev) => ({
        ...prev,
        resetToken: tokenFromUrl,
      }));
    }
  }, [searchParams]);

  const resetMessages = () => {
    setError('');
    setSuccess('');
  };

  const switchView = (view) => {
    resetMessages();
    setAuthView(view);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);

    try {
      if (authView === 'login' || authView === 'register') {
        const endpoint = authView === 'login' ? '/users/login' : '/users/register';
        const response = await axiosInstance.post(endpoint, {
          username: formData.username,
          password: formData.password,
          ...(authView === 'register' ? { email: formData.email } : {}),
        });

        if (response.data.token) {
          localStorage.setItem('token', response.data.token);
          localStorage.setItem('user', JSON.stringify(response.data.user));
          console.log('User authenticated successfully:', response.data.user);
          navigate('/');
        } else {
          throw new Error('No token received');
        }
        return;
      }

      if (authView === 'forgot') {
        const response = await axiosInstance.post('/users/forgot-password', {
          username: formData.username,
        });

        setSuccess(response.data.message);
        if (response.data.resetToken) {
          setFormData((prev) => ({
            ...prev,
            resetToken: response.data.resetToken,
          }));
          setAuthView('reset');
        }
        return;
      }

      if (authView === 'reset') {
        if (formData.newPassword !== formData.confirmPassword) {
          setError('Passwords do not match');
          return;
        }

        const response = await axiosInstance.post('/users/reset-password', {
          username: formData.username,
          resetToken: formData.resetToken,
          password: formData.newPassword,
        });

        setSuccess(response.data.message);
        setFormData((prev) => ({
          ...prev,
          password: '',
          resetToken: '',
          newPassword: '',
          confirmPassword: '',
        }));
        setAuthView('login');
      }
    } catch (submitError) {
      console.error('Auth error:', submitError);
      setError(submitError.response?.data?.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const titleByView = {
    login: 'Login',
    register: 'Register',
    forgot: 'Forgot Password',
    reset: 'Reset Password',
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>{titleByView[authView]}</h2>
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <form onSubmit={handleSubmit}>
          {(authView === 'login' || authView === 'register' || authView === 'forgot' || authView === 'reset') && (
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
                disabled={loading}
                autoComplete="username"
              />
            </div>
          )}

          {authView === 'register' && (
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                disabled={loading}
                autoComplete="email"
              />
            </div>
          )}

          {(authView === 'login' || authView === 'register') && (
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                disabled={loading}
                autoComplete={authView === 'login' ? 'current-password' : 'new-password'}
              />
            </div>
          )}

          {authView === 'reset' && (
            <>
              <div className="form-group">
                <label htmlFor="resetToken">Reset Code</label>
                <input
                  type="text"
                  id="resetToken"
                  name="resetToken"
                  value={formData.resetToken}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  autoComplete="one-time-code"
                />
              </div>

              <div className="form-group">
                <label htmlFor="newPassword">New Password</label>
                <input
                  type="password"
                  id="newPassword"
                  name="newPassword"
                  value={formData.newPassword}
                  onChange={handleChange}
                  required
                  minLength={6}
                  disabled={loading}
                  autoComplete="new-password"
                />
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm New Password</label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  minLength={6}
                  disabled={loading}
                  autoComplete="new-password"
                />
              </div>
            </>
          )}

          <button
            type="submit"
            className="submit-btn"
            disabled={loading}
          >
            {loading
              ? 'Processing...'
              : ({
                  login: 'Login',
                  register: 'Register',
                  forgot: 'Generate Reset Code',
                  reset: 'Reset Password',
                }[authView])}
          </button>
        </form>

        {authView === 'login' && (
          <>
            <button
              type="button"
              className="link-btn"
              onClick={() => switchView('forgot')}
              disabled={loading}
            >
              Forgot password?
            </button>
            <button
              className="toggle-btn"
              onClick={() => switchView('register')}
              disabled={loading}
            >
              Need an account? Register
            </button>
          </>
        )}

        {authView === 'register' && (
          <button
            className="toggle-btn"
            onClick={() => switchView('login')}
            disabled={loading}
          >
            Have an account? Login
          </button>
        )}

        {(authView === 'forgot' || authView === 'reset') && (
          <button
            className="toggle-btn"
            onClick={() => switchView('login')}
            disabled={loading}
          >
            Back to Login
          </button>
        )}
      </div>
    </div>
  );
};

export default Login;
