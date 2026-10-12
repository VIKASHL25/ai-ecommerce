import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register } from '../../api'
import { useApp } from '../../context/AppContext'

export default function Register() {
  const [form, setForm]       = useState({ name: '', email: '', password: '' })
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const { loginUser }         = useApp()
  const navigate              = useNavigate()

  const handleSubmit = async e => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const r = await register(form)
      loginUser(r.data.user, r.data.token)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed')
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
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🚀</div>
          <h1 className="gradient-text" style={{ fontSize: '1.8rem', fontWeight: 700 }}>
            Create Account
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', marginTop: '0.5rem' }}>
            Join AI Shop today
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {[
            { key: 'name',     label: 'Full Name', type: 'text',     placeholder: 'Vikas H L' },
            { key: 'email',    label: 'Email',     type: 'email',    placeholder: 'you@example.com' },
            { key: 'password', label: 'Password',  type: 'password', placeholder: '••••••••' },
          ].map(({ key, label, type, placeholder }) => (
            <div key={key}>
              <label style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.4rem', display: 'block' }}>
                {label}
              </label>
              <input
                className="input-glass" type={type} required
                placeholder={placeholder}
                value={form[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
              />
            </div>
          ))}

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
            type="submit" className="btn-primary"
            disabled={loading} style={{ marginTop: '0.5rem', padding: '0.875rem' }}
          >
            {loading ? '⏳ Creating account...' : 'Create Account 🎉'}
          </button>
        </form>

        <p style={{
          textAlign: 'center', marginTop: '1.5rem',
          color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem'
        }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#a78bfa', fontWeight: 600 }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}