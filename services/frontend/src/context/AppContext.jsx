import React, { createContext, useContext, useState, useEffect } from 'react'
import { getMe, getCart } from '../api'

const AppContext = createContext()

export function AppProvider({ children }) {
  const [user,        setUser]        = useState(null)
  const [cartCount,   setCartCount]   = useState(0)
  const [toast,       setToast]       = useState(null)
  const [loading,     setLoading]     = useState(true)

  // Load user on mount
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      getMe()
        .then(r => { setUser(r.data); refreshCart() })
        .catch(() => { localStorage.removeItem('token') })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const refreshCart = async () => {
    try {
      const r = await getCart()
      setCartCount(r.data.item_count || 0)
    } catch { setCartCount(0) }
  }

  const showToast = (msg, duration = 3000) => {
    setToast(msg)
    setTimeout(() => setToast(null), duration)
  }

  const loginUser = (userData, token) => {
    localStorage.setItem('token', token)
    setUser(userData)
    refreshCart()
  }

  const logoutUser = () => {
    localStorage.removeItem('token')
    setUser(null)
    setCartCount(0)
  }

  return (
    <AppContext.Provider value={{
      user, setUser,
      cartCount, setCartCount, refreshCart,
      toast, showToast,
      loading,
      loginUser, logoutUser
    }}>
      {children}
      {toast && <div className="toast">🔔 {toast}</div>}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)