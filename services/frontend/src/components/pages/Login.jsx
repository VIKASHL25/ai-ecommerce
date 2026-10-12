import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { login } from '../../api'
import { useApp } from '../../context/AppContext'

export default function Login() {
  const [form, setForm]       = useState({ email: '', password: '' })
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const { loginUser }         = useApp()
  const navigate              = useNavigate()

  const handleSubmit = async e => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const r = await login(form)
      loginUser(r.data.user, r.data.token)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: 'calc(100vh - 70px)',
      display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: '2rem'
    }}>
      <div className="glass fade-in" style={{
        width: '100%', maxWidth: '420px', padding: '2.5rem'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🔐</div>
          <h1 className="gradient-text" style={{ fontSize: '1.8rem', fontWeight: 700 }}>
            Welcome Back
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', marginTop: '0.5rem' }}>
            Sign in to your account
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.4rem', display: 'block' }}>
              Email
            </label>
            <input
              className="input-glass"
              type="email" required
              placeholder="you@example.com"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.4rem', display: 'block' }}>
              Password
            </label>
            <input
              className="input-glass"
              type="password" required
              placeholder="••••••••"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            />
          </div>

          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.15)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '10px', color: '#f87171',
              fontSize: '0.87rem', padding: '0.75rem 1rem'
            }}>
              ❌ {error}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{ marginTop: '0.5rem', padding: '0.875rem' }}
          >
            {loading ? '⏳ Signing in...' : 'Sign In →'}
          </button>
        </form>

        <p style={{
          textAlign: 'center', marginTop: '1.5rem',
          color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem'
        }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: '#a78bfa', fontWeight: 600 }}>
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}