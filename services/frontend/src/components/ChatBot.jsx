import React, { useState, useRef, useEffect } from 'react'
import { chatWithBot } from '../api'

export default function ChatBot() {
  const [open,    setOpen]    = useState(false)
  const [input,   setInput]   = useState('')
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState([
    { role: 'assistant', content: "Hi! I'm ShopBot 🤖 How can I help you today?" }
  ])
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history])

  const send = async () => {
    if (!input.trim() || loading) return
    const msg = input.trim()
    setInput('')
    setHistory(h => [...h, { role: 'user', content: msg }])
    setLoading(true)
    try {
      const r = await chatWithBot({
        message: msg,
        history: history.slice(-6)
      })
      setHistory(h => [...h, { role: 'assistant', content: r.data.reply }])
    } catch {
      setHistory(h => [...h, {
        role: 'assistant',
        content: "Sorry, I'm having trouble right now. Please try again!"
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'fixed', bottom: '2rem', right: '2rem',
          width: '60px', height: '60px', borderRadius: '50%',
          background: 'linear-gradient(135deg,#7c3aed,#3b82f6)',
          border: 'none', cursor: 'pointer', fontSize: '1.6rem',
          boxShadow: '0 8px 25px rgba(124,58,237,0.5)',
          transition: 'all 0.3s', zIndex: 9000,
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        {open ? '✕' : '🤖'}
      </button>

      {/* Chat Window */}
      {open && (
        <div className="glass-dark slide-in" style={{
          position: 'fixed', bottom: '6rem', right: '2rem',
          width: '360px', height: '500px',
          display: 'flex', flexDirection: 'column',
          zIndex: 8999, overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '1rem 1.25rem',
            background: 'linear-gradient(135deg,rgba(124,58,237,0.3),rgba(59,130,246,0.3))',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            display: 'flex', alignItems: 'center', gap: '0.75rem'
          }}>
            <span style={{ fontSize: '1.5rem' }}>🤖</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>ShopBot AI</div>
              <div style={{ fontSize: '0.75rem', color: '#34d399' }}>● Online</div>
            </div>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: 'auto',
            padding: '1rem', display: 'flex',
            flexDirection: 'column', gap: '0.75rem'
          }}>
            {history.map((msg, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
              }}>
                <div style={{
                  maxWidth: '80%', padding: '0.65rem 1rem',
                  borderRadius: msg.role === 'user'
                    ? '16px 16px 4px 16px'
                    : '16px 16px 16px 4px',
                  background: msg.role === 'user'
                    ? 'linear-gradient(135deg,#7c3aed,#3b82f6)'
                    : 'rgba(255,255,255,0.1)',
                  fontSize: '0.87rem', lineHeight: 1.5,
                  color: 'rgba(255,255,255,0.95)'
                }}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{
                padding: '0.65rem 1rem', width: 'fit-content',
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '16px 16px 16px 4px',
                animation: 'pulse 1s infinite'
              }}>
                ✍️ Typing...
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: '0.75rem 1rem',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            display: 'flex', gap: '0.5rem'
          }}>
            <input
              className="input-glass"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Ask me anything..."
              style={{ flex: 1, padding: '0.6rem 1rem', fontSize: '0.87rem' }}
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              className="btn-primary"
              style={{ padding: '0.6rem 1rem', minWidth: '50px' }}
            >
              ➤
            </button>
          </div>
        </div>
      )}
    </>
  )
}