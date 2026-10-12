import React, { useState, useEffect, useCallback } from 'react'
import { getProducts, getCategories, searchProducts,
         getSuggestions, getRecommend, getTrending, seedCatalog } from '../../api'
import ProductCard from '../ProductCard'
import { useApp } from '../../context/AppContext'

export default function Home() {
  const { user, showToast } = useApp()
  const [products,     setProducts]     = useState([])
  const [categories,   setCategories]   = useState([])
  const [recommended,  setRecommended]  = useState([])
  const [trending,     setTrending]     = useState([])
  const [search,       setSearch]       = useState('')
  const [suggestions,  setSuggestions]  = useState([])
  const [category,     setCategory]     = useState('')
  const [sortBy,       setSortBy]       = useState('default')
  const [inStockOnly,  setInStockOnly]  = useState(false)
  const [priceRange,   setPriceRange]   = useState('all')
  const [page,         setPage]         = useState(1)
  const [totalPages,   setTotalPages]   = useState(1)
  const [totalCount,   setTotalCount]   = useState(0)
  const [loading,      setLoading]      = useState(true)
  const [searching,    setSearching]    = useState(false)
  const [aiSearch,     setAiSearch]     = useState(false)

  // Initial load
  useEffect(() => {
    loadCategoriesAndTrending()
  }, [])

  // When filters, sort, or page change
  useEffect(() => {
    if (!search) {
      fetchCatalogPage()
    }
  }, [category, sortBy, inStockOnly, priceRange, page])

  const loadCategoriesAndTrending = async () => {
    try {
      const [cats, trend] = await Promise.all([
        getCategories(),
        getTrending(),
      ])
      setCategories(cats.data.categories || [])
      setTrending(trend.data.trending || [])

      if (user) {
        const rec = await getRecommend({ user_interests: [], limit: 4 })
        setRecommended(rec.data.recommendations || [])
      }
    } catch (e) {
      console.error(e)
    }
  }

  const fetchCatalogPage = async () => {
    setLoading(true)
    try {
      const params = {
        page,
        limit: 24,
        sort_by: sortBy,
      }
      if (category) params.category = category
      if (inStockOnly) params.in_stock = true

      if (priceRange === 'under50') { params.max_price = 50 }
      else if (priceRange === '50to150') { params.min_price = 50; params.max_price = 150 }
      else if (priceRange === '150to500') { params.min_price = 150; params.max_price = 500 }
      else if (priceRange === 'over500') { params.min_price = 500 }

      const res = await getProducts(params)
      setProducts(res.data.products || [])
      setTotalPages(res.data.total_pages || 1)
      setTotalCount(res.data.total || (res.data.products || []).length)
      setAiSearch(false)
    } catch (err) {
      console.error(err)
      setProducts([])
    } finally {
      setLoading(false)
    }
  }

  // Auto suggestions debounce
  useEffect(() => {
    if (search.length >= 2) {
      const timer = setTimeout(() => {
        getSuggestions(search)
          .then(r => setSuggestions(r.data.suggestions || []))
          .catch(() => setSuggestions([]))
      }, 200)
      return () => clearTimeout(timer)
    } else {
      setSuggestions([])
    }
  }, [search])

  const handleSearch = async (q = search) => {
    const term = q.trim()
    if (!term) {
      setSearch('')
      setPage(1)
      fetchCatalogPage()
      return
    }
    setSearching(true)
    setSuggestions([])
    try {
      const r = await searchProducts(term)
      setProducts(r.data.results || [])
      setTotalCount(r.data.count || (r.data.results || []).length)
      setTotalPages(1)
      setAiSearch(r.data.ai_powered)
    } catch {
      setProducts([])
    } finally {
      setSearching(false)
    }
  }

  const handleCategorySelect = (cat) => {
    setCategory(cat)
    setSearch('')
    setPage(1)
  }

  const handleResetFilters = () => {
    setCategory('')
    setSearch('')
    setSortBy('default')
    setInStockOnly(false)
    setPriceRange('all')
    setPage(1)
  }

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '2rem 1.5rem' }}>

      {/* Hero Header */}
      <div className="fade-in" style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <div style={{
          display: 'inline-block', padding: '0.35rem 1rem', borderRadius: '30px',
          background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)',
          color: '#a78bfa', fontSize: '0.85rem', fontWeight: 600, marginBottom: '1rem'
        }}>
          ⚡ Large-Scale Multi-Category Marketplace &amp; AI Engine
        </div>
        <h1 style={{ fontSize: 'clamp(2.2rem, 5vw, 3.8rem)', fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.5px' }}>
          Shop High-Tech &amp; Essentials with{' '}
          <span className="gradient-text">Next-Gen AI</span>
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '1.15rem', marginTop: '0.85rem', maxWidth: '680px', margin: '0.85rem auto 0' }}>
          Explore 80+ catalog items across Electronics, Smart Home, Fashion, Gaming &amp; Fitness with semantic AI search.
        </p>

        {/* Search Bar */}
        <div style={{ position: 'relative', maxWidth: '640px', margin: '2rem auto 0' }}>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                className="input-glass"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="🔍 Try: 'wireless earbuds for running' or 'ergonomic desk setup'..."
                style={{ paddingRight: '2.5rem', fontSize: '1rem', height: '48px' }}
              />
              {search && (
                <button
                  onClick={() => { setSearch(''); fetchCatalogPage() }}
                  style={{
                    position: 'absolute', right: '0.75rem', top: '50%',
                    transform: 'translateY(-50%)', background: 'none',
                    border: 'none', color: 'rgba(255,255,255,0.5)',
                    cursor: 'pointer', fontSize: '1.1rem'
                  }}
                >✕</button>
              )}
            </div>
            <button
              onClick={() => handleSearch()}
              className="btn-primary"
              disabled={searching}
              style={{ whiteSpace: 'nowrap', height: '48px', padding: '0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              {searching ? '⏳ Searching...' : '✨ AI Search'}
            </button>
          </div>

          {/* Suggestions Dropdown */}
          {suggestions.length > 0 && (
            <div className="glass-dark" style={{
              position: 'absolute', top: '110%', left: 0,
              right: 0, zIndex: 100, overflow: 'hidden',
              boxShadow: '0 15px 35px rgba(0,0,0,0.4)',
              border: '1px solid rgba(124,58,237,0.3)'
            }}>
              {suggestions.map((s, i) => (
                <div
                  key={i}
                  onClick={() => { setSearch(s); handleSearch(s) }}
                  style={{
                    padding: '0.75rem 1rem', cursor: 'pointer',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    fontSize: '0.92rem', color: 'rgba(255,255,255,0.85)',
                    transition: 'background 0.2s', textAlign: 'left'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,58,237,0.2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  🔍 {s}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Category Pills Bar */}
      <div style={{
        display: 'flex', gap: '0.6rem', overflowX: 'auto',
        paddingBottom: '0.75rem', marginBottom: '1.75rem',
        scrollbarWidth: 'none', msOverflowStyle: 'none'
      }}>
        <button
          onClick={() => handleCategorySelect('')}
          style={{
            padding: '0.55rem 1.25rem', borderRadius: '30px', whiteSpace: 'nowrap',
            border: !category ? 'none' : '1px solid rgba(255,255,255,0.18)',
            background: !category ? 'linear-gradient(135deg,#7c3aed,#3b82f6)' : 'rgba(255,255,255,0.07)',
            color: 'white', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600,
            transition: 'all 0.2s ease', boxShadow: !category ? '0 4px 15px rgba(124,58,237,0.4)' : 'none'
          }}
        >
          All Departments
        </button>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => handleCategorySelect(cat)}
            style={{
              padding: '0.55rem 1.25rem', borderRadius: '30px', whiteSpace: 'nowrap',
              border: category === cat ? 'none' : '1px solid rgba(255,255,255,0.18)',
              background: category === cat ? 'linear-gradient(135deg,#7c3aed,#3b82f6)' : 'rgba(255,255,255,0.07)',
              color: 'white', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600,
              transition: 'all 0.2s ease', boxShadow: category === cat ? '0 4px 15px rgba(124,58,237,0.4)' : 'none'
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Filter and Sort Toolbar */}
      <div className="glass" style={{
        padding: '0.9rem 1.25rem', marginBottom: '2rem',
        display: 'flex', flexWrap: 'wrap', alignItems: 'center',
        justifyContent: 'space-between', gap: '1rem',
        borderRadius: '14px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          {/* Price Range Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)' }}>Price:</span>
            <select
              value={priceRange}
              onChange={e => { setPriceRange(e.target.value); setPage(1) }}
              style={{
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                color: 'white', borderRadius: '8px', padding: '0.4rem 0.75rem',
                fontSize: '0.82rem', outline: 'none', cursor: 'pointer'
              }}
            >
              <option value="all" style={{ background: '#1e1b4b' }}>All Prices</option>
              <option value="under50" style={{ background: '#1e1b4b' }}>Under $50</option>
              <option value="50to150" style={{ background: '#1e1b4b' }}>$50 - $150</option>
              <option value="150to500" style={{ background: '#1e1b4b' }}>$150 - $500</option>
              <option value="over500" style={{ background: '#1e1b4b' }}>$500+</option>
            </select>
          </div>

          {/* In-Stock Only Toggle */}
          <label style={{
            display: 'flex', alignItems: 'center', gap: '0.45rem',
            cursor: 'pointer', fontSize: '0.82rem', color: 'rgba(255,255,255,0.8)'
          }}>
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={e => { setInStockOnly(e.target.checked); setPage(1) }}
              style={{ accentColor: '#7c3aed', cursor: 'pointer' }}
            />
            In-Stock Only
          </label>

          {(category || priceRange !== 'all' || inStockOnly || search) && (
            <button
              onClick={handleResetFilters}
              style={{
                background: 'none', border: 'none', color: '#a78bfa',
                cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline'
              }}
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Sort Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)' }}>Sort By:</span>
          <select
            value={sortBy}
            onChange={e => { setSortBy(e.target.value); setPage(1) }}
            style={{
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
              color: 'white', borderRadius: '8px', padding: '0.4rem 0.75rem',
              fontSize: '0.82rem', outline: 'none', cursor: 'pointer'
            }}
          >
            <option value="default" style={{ background: '#1e1b4b' }}>Featured &amp; Top Rated</option>
            <option value="price_asc" style={{ background: '#1e1b4b' }}>Price: Low to High</option>
            <option value="price_desc" style={{ background: '#1e1b4b' }}>Price: High to Low</option>
            <option value="rating" style={{ background: '#1e1b4b' }}>Highest Customer Rating</option>
            <option value="popular" style={{ background: '#1e1b4b' }}>Most Reviewed / Popular</option>
            <option value="newest" style={{ background: '#1e1b4b' }}>New Arrivals</option>
          </select>
        </div>
      </div>

      {/* AI Recommendations (for logged-in users) */}
      {user && recommended.length > 0 && !search && (
        <section style={{ marginBottom: '3rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700 }}>
              ✨ <span className="gradient-text">Curated by AI for You</span>
            </h2>
            <span style={{
              background: 'rgba(124,58,237,0.2)', color: '#c084fc',
              fontSize: '0.72rem', padding: '0.2rem 0.6rem', borderRadius: '12px'
            }}>
              Personalized
            </span>
          </div>
          <div style={{
            display: 'grid', gap: '1.25rem',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))'
          }}>
            {recommended.map(p => (
              <ProductCard key={p.id} product={p} reason={p.reason} />
            ))}
          </div>
        </section>
      )}

      {/* Trending Picks */}
      {!search && !category && trending.length > 0 && (
        <section style={{ marginBottom: '3rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700 }}>
              🔥 <span className="gradient-text">Trending Bestsellers</span>
            </h2>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>
              Top rated by community
            </span>
          </div>
          <div style={{
            display: 'grid', gap: '1.25rem',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))'
          }}>
            {trending.slice(0, 4).map(p => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* Main Products Grid */}
      <section>
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', marginBottom: '1.25rem'
        }}>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700 }}>
            {search
              ? <>🔍 Results for <span className="gradient-text">"{search}"</span></>
              : category
                ? <><span className="gradient-text">{category}</span></>
                : '🛍️ Complete Product Catalog'
            }
            <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.88rem', fontWeight: 400, marginLeft: '0.75rem' }}>
              ({totalCount} products)
            </span>
          </h2>
          {aiSearch && (
            <span style={{
              background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.4)',
              borderRadius: '20px', color: '#a78bfa', fontSize: '0.78rem',
              fontWeight: 600, padding: '0.25rem 0.75rem'
            }}>
              ✨ AI Ranked &amp; Filtered
            </span>
          )}
        </div>

        {loading || searching ? (
          <div style={{
            display: 'grid', gap: '1.25rem',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))'
          }}>
            {[...Array(12)].map((_, i) => (
              <div key={i} className="glass" style={{
                height: '320px', animation: 'pulse 1.5s ease infinite', borderRadius: '16px'
              }} />
            ))}
          </div>
        ) : products.length > 0 ? (
          <>
            <div style={{
              display: 'grid', gap: '1.25rem',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))'
            }}>
              {products.map(p => <ProductCard key={p.id} product={p} />)}
            </div>

            {/* Pagination Controls */}
            {!search && totalPages > 1 && (
              <div style={{
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                gap: '0.5rem', marginTop: '3rem', flexWrap: 'wrap'
              }}>
                <button
                  onClick={() => { setPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 400, behavior: 'smooth' }) }}
                  disabled={page === 1}
                  className="btn-secondary"
                  style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                >
                  ← Prev
                </button>

                {[...Array(totalPages)].map((_, i) => {
                  const pNum = i + 1
                  return (
                    <button
                      key={pNum}
                      onClick={() => { setPage(pNum); window.scrollTo({ top: 400, behavior: 'smooth' }) }}
                      style={{
                        width: '38px', height: '38px', borderRadius: '10px',
                        border: page === pNum ? 'none' : '1px solid rgba(255,255,255,0.15)',
                        background: page === pNum ? 'linear-gradient(135deg,#7c3aed,#3b82f6)' : 'rgba(255,255,255,0.08)',
                        color: 'white', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {pNum}
                    </button>
                  )
                })}

                <button
                  onClick={() => { setPage(p => Math.min(totalPages, p + 1)); window.scrollTo({ top: 400, behavior: 'smooth' }) }}
                  disabled={page === totalPages}
                  className="btn-secondary"
                  style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🔍</div>
            <h3 style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1.25rem' }}>No products match your criteria</h3>
            <p style={{ color: 'rgba(255,255,255,0.4)', marginTop: '0.5rem' }}>
              Try adjusting your search query, price filter, or clear filters.
            </p>
            <button
              onClick={handleResetFilters}
              className="btn-primary"
              style={{ marginTop: '1.5rem', padding: '0.6rem 1.5rem' }}
            >
              Browse All Products
            </button>
          </div>
        )}
      </section>
    </div>
  )
}