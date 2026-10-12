import React from 'react'
import { useNavigate } from 'react-router-dom'
import { addToCart } from '../api'
import { useApp } from '../context/AppContext'

export default function ProductCard({ product, reason }) {
  const { user, refreshCart, showToast } = useApp()
  const navigate = useNavigate()

  const handleAddToCart = async (e) => {
    e.stopPropagation()
    if (!user) { navigate('/login'); return }
    try {
      await addToCart({
        product_id:   product.id,
        product_name: product.name,
        price:        product.price,
        quantity:     1,
        image:        product.image || '📦'
      })
      await refreshCart()
      showToast(`${product.image || '📦'} ${product.name} added to cart!`)
    } catch {
      showToast('Failed to add to cart')
    }
  }

  return (
    <div
      className="glass"
      onClick={() => navigate(`/product/${product.id}`)}
      style={{
        cursor: 'pointer', padding: '1.25rem',
        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)', position: 'relative',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        borderRadius: '16px'
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-6px)'
        e.currentTarget.style.boxShadow = '0 20px 40px rgba(124,58,237,0.25)'
        e.currentTarget.style.borderColor = 'rgba(124,58,237,0.5)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'
      }}
    >
      {/* Top badges: Category & Brand */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', gap: '0.5rem' }}>
        <span style={{
          background: 'rgba(124,58,237,0.25)',
          border: '1px solid rgba(124,58,237,0.4)',
          borderRadius: '20px', color: '#a78bfa',
          fontSize: '0.72rem', fontWeight: 600,
          padding: '0.2rem 0.6rem', whiteSpace: 'nowrap'
        }}>
          {product.category}
        </span>
        {product.brand && (
          <span style={{
            color: 'rgba(255,255,255,0.5)',
            fontSize: '0.72rem', fontWeight: 500,
            textTransform: 'uppercase', letterSpacing: '0.5px'
          }}>
            {product.brand}
          </span>
        )}
      </div>

      {/* Product image / emoji */}
      <div style={{
        fontSize: '3.6rem', textAlign: 'center',
        margin: '0.75rem 0', lineHeight: 1,
        transition: 'transform 0.3s ease'
      }}>
        {product.image || '📦'}
      </div>

      {/* Rating & Reviews */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.4rem' }}>
        <span style={{ color: '#fbbf24', fontSize: '0.82rem' }}>★</span>
        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f3f4f6' }}>
          {product.rating ? Number(product.rating).toFixed(1) : '4.8'}
        </span>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>
          ({product.reviews_count || 120})
        </span>
      </div>

      {/* Name */}
      <h3 style={{
        fontSize: '0.98rem', fontWeight: 600,
        margin: '0 0 0.4rem',
        color: 'rgba(255,255,255,0.95)',
        lineHeight: 1.3
      }}>
        {product.name}
      </h3>

      {/* Description */}
      <p style={{
        fontSize: '0.8rem', color: 'rgba(255,255,255,0.55)',
        lineHeight: 1.45, marginBottom: '0.75rem',
        display: '-webkit-box', WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical', overflow: 'hidden'
      }}>
        {product.description}
      </p>

      {/* AI reason if present */}
      {reason && (
        <div style={{
          background: 'rgba(59,130,246,0.12)',
          border: '1px solid rgba(59,130,246,0.25)',
          borderRadius: '8px', padding: '0.35rem 0.6rem',
          marginBottom: '0.75rem', fontSize: '0.75rem',
          color: '#93c5fd'
        }}>
          ✨ {reason}
        </div>
      )}

      {/* Price + Add to cart */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', marginTop: 'auto',
        paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.08)'
      }}>
        <div>
          <span style={{
            fontSize: '1.25rem', fontWeight: 700,
            background: 'linear-gradient(90deg,#a78bfa,#60a5fa)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            ${typeof product.price === 'number' ? product.price.toFixed(2) : product.price}
          </span>
          {product.stock !== undefined && product.stock <= 15 && (
            <div style={{ color: '#f87171', fontSize: '0.7rem', fontWeight: 500 }}>
              Only {product.stock} left
            </div>
          )}
        </div>
        <button
          onClick={handleAddToCart}
          className="btn-primary"
          style={{ padding: '0.45rem 0.9rem', fontSize: '0.8rem', borderRadius: '10px' }}
        >
          Add 🛒
        </button>
      </div>
    </div>
  )
}