import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'

export default function Navbar() {
  const { user, cartCount, logoutUser } = useApp()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = () => {
    logoutUser()
    navigate('/')
  }

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 1000,
      background: 'rgba(15, 12, 41, 0.85)',
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(255,255,255,0.1)',
      padding: '0 2rem',
    }}>
      <div style={{
        maxWidth: '1400px', margin: '0 auto',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', height: '70px',
      }}>
        {/* Logo */}
        <Link to="/" style={{ textDecoration: 'none' }}>
          <span style={{ fontSize: '1.5rem', fontWeight: 700 }}>
            🛍️ <span className="gradient-text">AI Shop</span>
          </span>
        </Link>

        {/* Nav links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <Link to="/" style={{
            color: 'rgba(255,255,255,0.8)', textDecoration: 'none',
            fontSize: '0.95rem', fontWeight: 500,
            transition: 'color 0.2s'
          }}>Home</Link>

          {user && (
            <>
              {/* Cart */}
              <Link to="/cart" style={{ position: 'relative', textDecoration: 'none' }}>
                <span style={{ fontSize: '1.4rem' }}>🛒</span>
                {cartCount > 0 && <span className="badge">{cartCount}</span>}
              </Link>
              {/* Orders */}
              <Link to="/orders" style={{
                color: 'rgba(255,255,255,0.8)', textDecoration: 'none',
                fontSize: '0.95rem', fontWeight: 500
              }}>Orders</Link>
              {/* User + Logout */}
              <span style={{
                color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem'
              }}>👋 {user.name}</span>
              <button
                onClick={handleLogout}
                className="btn-secondary"
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
              >Logout</button>
            </>
          )}

          {!user && (
            <>
              <Link to="/login">
                <button className="btn-secondary"
                  style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                  Login
                </button>
              </Link>
              <Link to="/register">
                <button className="btn-primary"
                  style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                  Sign Up
                </button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}