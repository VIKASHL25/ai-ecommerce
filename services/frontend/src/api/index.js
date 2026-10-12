import axios from 'axios'

const BASE = '/api'

// Axios instance
const api = axios.create({ baseURL: BASE })

// Auto-attach JWT token
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── Auth ──────────────────────────────────────────────────────────
export const register = (data)  => api.post('/auth/register', data)
export const login    = (data)  => api.post('/auth/login', data)
export const getMe    = ()      => api.get('/auth/me')

// ── Products ──────────────────────────────────────────────────────
export const getProducts    = (params) => api.get('/products/', { params })
export const getProduct     = (id)     => api.get(`/products/${id}`)
export const getCategories  = ()       => api.get('/products/categories')
export const getFeatured    = ()       => api.get('/products/featured')
export const seedCatalog    = (force = false) => api.post('/products/seed', null, { params: { force } })

// ── Orders / Cart ─────────────────────────────────────────────────
export const getCart        = ()       => api.get('/orders/cart')
export const addToCart      = (data)   => api.post('/orders/cart', data)
export const updateCart     = (id, q)  => api.put(`/orders/cart/${id}`, { quantity: q })
export const removeFromCart = (id)     => api.delete(`/orders/cart/${id}`)
export const clearCart      = ()       => api.delete('/orders/cart')
export const checkout       = ()       => api.post('/orders/checkout')
export const getOrders      = ()       => api.get('/orders/')
export const getOrder       = (id)     => api.get(`/orders/${id}`)

// ── AI Services ───────────────────────────────────────────────────
export const chatWithBot    = (data)   => api.post('/chat/', data)
export const getRecommend   = (data)   => api.post('/recommend/', data)
export const getTrending    = ()       => api.get('/recommend/trending')
export const searchProducts = (q)      => api.get('/search/', { params: { q } })
export const getSuggestions = (q)      => api.get('/search/suggest', { params: { q } })