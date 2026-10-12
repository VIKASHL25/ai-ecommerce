import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getProduct, getRecommend, addToCart } from '../../api'
import { useApp } from '../../context/AppContext'
import ProductCard from '../ProductCard'

export default function ProductDetail() {
  const { id }                         = useParams()
  const navigate                       = useNavigate()
  const { user, refreshCart, showToast } = useApp()
  const [product,  setProduct]         = useState(null)
  const [related,  setRelated]         = useState([])
  const [qty,      setQty]             = useState(1)
  const [loading,  setLoading]         = useState(true)
  const [adding,   setAdding]          = useState(false)

  useEffect(() => {
    setLoading(true)
    getProduct(id).then(r => {
      setProduct(r.data)
      return getRecommend({ product_id: id, category: r.data.category, limit: 4 })
    }).then(r => {
      setRelated(r.data.recommendations.filter(p => p.id !== id))
    }).catch(() => navigate('/')).finally(() => setLoading(false))
  }, [id])

  const handleAddToCart = async () => {
    if (!user) { navigate('/login'); return }
    setAdding(true)
    try {
      await addToCart({
        product_id:   product.id,
        product_name: product.name,
        price:        product.price,
        quantity:     qty,
        image:        product.image || '📦'
      })
      await refreshCart()
      showToast(`${product.image} ${product.name} × ${qty} added to cart!`)
    } catch {
      showToast('Failed to add to cart')
    } finally {
      setAdding(false)
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', fontSize: '2rem' }}>
      ⏳
    </div>
  )

  if (!product) return null

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      <button
        onClick={() => navigate(-1)}
        className="btn-secondary"
        style={{ marginBottom: '2rem', padding: '0.5rem 1rem', fontSize: '0.85rem' }}
      >
        ← Back
      </button>

      <div className="glass fade-in" style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: '3rem', padding: '2.5rem', marginBottom: '3rem'
      }}>
        {/* Image */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(255,255,255,0.05)', borderRadius: '16px',
          minHeight: '300px', fontSize: '8rem'
        }}>
          {product.image || '📦'}
        </div>

        {/* Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <span style={{
            background: 'rgba(124,58,237,0.25)', border: '1px solid rgba(124,58,237,0.4)',
            borderRadius: '20px', color: '#a78bfa', fontSize: '0.8rem',
            fontWeight: 600, padding: '0.3rem 0.8rem', width: 'fit-content'
          }}>
            {product.category}
          </span>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700 }}>{product.name}</h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.7 }}>
            {product.description}
          </p>
          <div className="gradient-text" style={{ fontSize: '2.5rem', fontWeight: 800 }}>
            ${product.price}
          </div>

          {product.stock !== undefined && (
            <p style={{ color: product.stock > 10 ? '#34d399' : '#f87171', fontSize: '0.9rem' }}>
              {product.stock > 0
                ? `✅ In stock (${product.stock} available)`
                : '❌ Out of stock'}
            </p>
          )}

          {/* Quantity selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              background: 'rgba(255,255,255,0.08)',
              borderRadius: '12px', padding: '0.5rem 1rem'
            }}>
              <button
                onClick={() => setQty(q => Math.max(1, q-1))}
                style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.2rem', cursor: 'pointer' }}
              >−</button>
              <span style={{ fontSize: '1.1rem', fontWeight: 600, minWidth: '24px', textAlign: 'center' }}>
                {qty}
              </span>
              <button
                onClick={() => setQty(q => q+1)}
                style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.2rem', cursor: 'pointer' }}
              >+</button>
            </div>
          </div>

          <button
            onClick={handleAddToCart}
            disabled={adding || product.stock === 0}
            className="btn-primary"
            style={{ padding: '1rem', fontSize: '1rem', marginTop: '0.5rem' }}
          >
            {adding ? '⏳ Adding...' : `🛒 Add to Cart — $${(product.price * qty).toFixed(2)}`}
          </button>
        </div>
      </div>

      {/* Related products */}
      {related.length > 0 && (
        <section>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '1.25rem' }}>
            ✨ <span className="gradient-text">AI Recommends</span>
          </h2>
          <div style={{
            display: 'grid', gap: '1.25rem',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))'
          }}>
            {related.map(p => <ProductCard key={p.id} product={p} reason={p.reason} />)}
          </div>
        </section>
      )}
    </div>
  )
}