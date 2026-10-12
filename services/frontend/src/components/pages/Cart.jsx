import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCart, updateCart, removeFromCart, checkout } from '../../api'
import { useApp } from '../../context/AppContext'

export default function Cart() {
  const [cart,     setCart]     = useState({ cart: [], total: 0, item_count: 0 })
  const [loading,  setLoading]  = useState(true)
  const [checking, setChecking] = useState(false)
  const { refreshCart, showToast } = useApp()
  const navigate = useNavigate()

  useEffect(() => { loadCart() }, [])

  const loadCart = async () => {
    setLoading(true)
    try {
      const r = await getCart()
      setCart(r.data)
    } catch { setCart({ cart: [], total: 0, item_count: 0 }) }
    finally { setLoading(false) }
  }

  const handleQty = async (productId, qty) => {
    try {
      await updateCart(productId, qty)
      await Promise.all([loadCart(), refreshCart()])
    } catch { showToast('Failed to update cart') }
  }

  const handleRemove = async (productId, name) => {
    try {
      await removeFromCart(productId)
      await Promise.all([loadCart(), refreshCart()])
      showToast(`${name} removed from cart`)
    } catch { showToast('Failed to remove item') }
  }

  const handleCheckout = async () => {
    setChecking(true)
    try {
      const r = await checkout()
      await Promise.all([loadCart(), refreshCart()])
      showToast(`🎉 Order #${r.data.order_id} placed! Total: $${r.data.total}`)
      setTimeout(() => navigate('/orders'), 2000)
    } catch (err) {
      showToast(err.response?.data?.detail || 'Checkout failed')
    } finally {
      setChecking(false)
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', fontSize: '2rem' }}>
      ⏳
    </div>
  )

  if (cart.cart.length === 0) return (
    <div style={{ maxWidth: '800px', margin: '4rem auto', padding: '2rem', textAlign: 'center' }}>
      <div style={{ fontSize: '5rem', marginBottom: '1rem' }}>🛒</div>
      <h2 style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '1.5rem' }}>Your cart is empty</h2>
      <button onClick={() => navigate('/')} className="btn-primary">
        Start Shopping →
      </button>
    </div>
  )

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem' }}>
      <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '2rem' }}>
        🛒 Your Cart
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '1rem', fontWeight: 400, marginLeft: '0.75rem' }}>
          ({cart.item_count} items)
        </span>
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '2rem', alignItems: 'start' }}>
        {/* Items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {cart.cart.map(item => (
            <div key={item.product_id} className="glass fade-in" style={{
              display: 'flex', alignItems: 'center',
              gap: '1.25rem', padding: '1.25rem'
            }}>
              <div style={{ fontSize: '2.5rem' }}>{item.image}</div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{item.product_name}</h3>
                <p className="gradient-text" style={{ fontWeight: 700, fontSize: '1.1rem', marginTop: '0.25rem' }}>
                  ${parseFloat(item.price).toFixed(2)}
                </p>
              </div>
              {/* Qty controls */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                background: 'rgba(255,255,255,0.08)', borderRadius: '10px',
                padding: '0.4rem 0.75rem'
              }}>
                <button onClick={() => handleQty(item.product_id, item.quantity - 1)}
                  style={{ background:'none', border:'none', color:'white', cursor:'pointer', fontSize:'1rem' }}>−</button>
                <span style={{ minWidth:'20px', textAlign:'center', fontWeight:600 }}>{item.quantity}</span>
                <button onClick={() => handleQty(item.product_id, item.quantity + 1)}
                  style={{ background:'none', border:'none', color:'white', cursor:'pointer', fontSize:'1rem' }}>+</button>
              </div>
              <p style={{ fontWeight: 700, minWidth: '70px', textAlign:'right' }}>
                ${(parseFloat(item.price) * item.quantity).toFixed(2)}
              </p>
              <button onClick={() => handleRemove(item.product_id, item.product_name)}
                style={{ background:'none', border:'none', color:'#f87171', cursor:'pointer', fontSize:'1.2rem' }}>
                🗑
              </button>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="glass" style={{ padding: '1.5rem', minWidth: '260px', position: 'sticky', top: '90px' }}>
          <h3 style={{ fontWeight: 700, marginBottom: '1.25rem', fontSize: '1.1rem' }}>Order Summary</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>
            <span>Subtotal</span><span>${cart.total.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>
            <span>Shipping</span>
            <span style={{ color: '#34d399' }}>
              {cart.total >= 50 ? 'FREE' : '$5.99'}
            </span>
          </div>
          {cart.total < 50 && (
            <p style={{ fontSize: '0.78rem', color: '#fbbf24', marginBottom: '0.75rem' }}>
              Add ${(50 - cart.total).toFixed(2)} more for free shipping!
            </p>
          )}
          <div style={{
            borderTop: '1px solid rgba(255,255,255,0.1)',
            paddingTop: '0.75rem', marginBottom: '1.25rem',
            display: 'flex', justifyContent: 'space-between',
            fontWeight: 700, fontSize: '1.15rem'
          }}>
            <span>Total</span>
            <span className="gradient-text">
              ${(cart.total + (cart.total >= 50 ? 0 : 5.99)).toFixed(2)}
            </span>
          </div>
          <button onClick={handleCheckout} disabled={checking} className="btn-primary"
            style={{ width: '100%', padding: '0.875rem', fontSize: '1rem' }}>
            {checking ? '⏳ Processing...' : '✅ Place Order'}
          </button>
          <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: '0.75rem' }}>
            🔒 Secure checkout
          </p>
        </div>
      </div>
    </div>
  )
}