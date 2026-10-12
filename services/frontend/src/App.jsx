import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider, useApp } from './context/AppContext'
import Navbar    from './components/Navbar'
import Home      from './components/pages/Home'
import Login     from './components/pages/Login'
import Register  from './components/pages/Register'
import Cart      from './components/pages/Cart'
import Orders    from './components/pages/Orders'
import ProductDetail from './components/pages/ProductDetail'
import ChatBot   from './components/ChatBot'

function ProtectedRoute({ children }) {
  const { user, loading } = useApp()
  if (loading) return <div style={{
    display:'flex', alignItems:'center',
    justifyContent:'center', height:'100vh', fontSize:'2rem'
  }}>⏳</div>
  return user ? children : <Navigate to="/login" />
}

function AppRoutes() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/"          element={<Home />} />
        <Route path="/login"     element={<Login />} />
        <Route path="/register"  element={<Register />} />
        <Route path="/product/:id" element={<ProductDetail />} />
        <Route path="/cart"      element={<ProtectedRoute><Cart /></ProtectedRoute>} />
        <Route path="/orders"    element={<ProtectedRoute><Orders /></ProtectedRoute>} />
      </Routes>
      <ChatBot />
    </>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AppRoutes />
    </AppProvider>
  )
}