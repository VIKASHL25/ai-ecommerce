import React, { useState, useEffect } from 'react'
import { getOrders, getOrder } from '../../api'
import { useNavigate } from 'react-router-dom'

const STATUS_COLORS = {
  pending:   '#fbbf24',
  confirmed: '#60a5fa',
  shipped:   '#a78bfa',
  delivered: '#34d399',
  cancelled: '#f87171',
}

export default function Orders() {
  const [orders,   setOrders]   = useState([])
  const [selected, setSelected] = useState(null)
  const [loading,  setLoading]  = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    getOrders()
      .then(r => setOrders(r.data.orders || []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false))
  }, [])

  const viewOrder = async (id) => {
    try {
      const r = await getOrder(id)
      setSelected(r.data)
    } catch { alert('Failed to load order') }
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', fontSize:'2rem' }}>
      ⏳
    </div>
  )

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem' }}>
      <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '2rem' }}>
        📦 Your Orders
      </h1>

      {orders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📦</div>
          <h3 style={{ color: 'rgba(255,255,255,0.6)' }}>No orders yet</h3>
          <button onClick={() => navigate('/')} className="btn-primary" style={{ marginTop: '1.5rem' }}>
            Start Shopping →
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {orders.map(order => (
            <div key={order.id} className="glass fade-in" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '1rem' }}>Order #{order.id}</span>
                    <span style={{
                      background: `${STATUS_COLORS[order.status]}22`,
                      border: `1px solid ${STATUS_COLORS[order.status]}66`,
                      borderRadius: '20px', color: STATUS_COLORS[order.status],
                      fontSize: '0.78rem', fontWeight: 600,
                      padding: '0.2rem 0.7rem', textTransform: 'capitalize'
                    }}>
                      {order.status}
                    </span>
                  </div>
                  <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', marginTop: '0.3rem' }}>
                    {new Date(order.created_at).toLocaleDateString('en-US', {
                      year: 'numeric', month: 'long', day: 'numeric'
                    })}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  <span className="gradient-text" style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                    ${parseFloat(order.total_amount).toFixed(2)}
                  </span>
                  <button onClick={() => viewOrder(order.id)} className="btn-secondary"
                    style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                    View Details
                  </button>
                </div>
              </div>

              {/* Order detail expanded */}
              {selected?.order?.id === order.id && (
                <div style={{
                  marginTop: '1.25rem', paddingTop: '1.25rem',
                  borderTop: '1px solid rgba(255,255,255,0.1)'
                }}>
                  <h4 style={{ marginBottom: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>Items:</h4>
                  {selected.items.map(item => (
                    <div key={item.id} style={{
                      display: 'flex', justifyContent: 'space-between',
                      padding: '0.5rem 0', color: 'rgba(255,255,255,0.7)',
                      borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem'
                    }}>
                      <span>{item.product_name} × {item.quantity}</span>
                      <span>${(parseFloat(item.price) * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                  <button onClick={() => setSelected(null)} className="btn-secondary"
                    style={{ marginTop: '1rem', padding: '0.4rem 0.9rem', fontSize: '0.8rem' }}>
                    Close
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}