import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import api from '../api/client.js'
import { useAuth } from './AuthContext.jsx'

const CartContext = createContext(null)

function readCart(response) {
  if (!response?.success || !response.data || !Array.isArray(response.data.items)) {
    throw new Error('Phản hồi giỏ hàng từ máy chủ không hợp lệ.')
  }
  return response.data
}

export function CartProvider({ children }) {
  const { user } = useAuth()
  const userId = user?.userId ?? null
  const [cart, setCart] = useState(null)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  const refreshCart = useCallback(async ({ showLoading = true } = {}) => {
    if (!userId) return null
    if (showLoading) setStatus('loading')
    setError('')
    try {
      const data = readCart(await api.get('/cart'))
      setCart(data)
      setStatus('success')
      return data
    } catch (requestError) {
      setError(requestError?.message || 'Không thể tải giỏ hàng. Vui lòng thử lại.')
      setStatus('error')
      throw requestError
    }
  }, [userId])

  useEffect(() => {
    let active = true
    if (!userId) {
      setCart(null)
      setStatus('idle')
      setError('')
      setPending(false)
      return undefined
    }

    setStatus('loading')
    setError('')
    api.get('/cart')
      .then(readCart)
      .then((data) => {
        if (!active) return
        setCart(data)
        setStatus('success')
      })
      .catch((requestError) => {
        if (!active) return
        setError(requestError?.message || 'Không thể tải giỏ hàng. Vui lòng thử lại.')
        setStatus('error')
      })
    return () => { active = false }
  }, [userId])

  const runMutation = useCallback(async (path, method, body) => {
    if (!userId) throw new Error('Vui lòng đăng nhập để sử dụng giỏ hàng.')
    if (pending) return
    setPending(true)
    setError('')
    try {
      if (method === 'POST') await api.post(path, body)
      else if (method === 'PUT') await api.put(path, body)
      else await api.delete(path)
      await refreshCart({ showLoading: false })
    } catch (requestError) {
      setError(requestError?.message || 'Không thể cập nhật giỏ hàng. Vui lòng thử lại.')
      throw requestError
    } finally {
      setPending(false)
    }
  }, [pending, refreshCart, userId])

  const addItem = useCallback((productId, quantity = 1) => runMutation('/cart/items', 'POST', { productId, quantity }), [runMutation])
  const updateQuantity = useCallback((productId, quantity) => runMutation(`/cart/items/${productId}`, 'PUT', { quantity }), [runMutation])
  const removeItem = useCallback((productId) => runMutation(`/cart/items/${productId}`, 'DELETE'), [runMutation])
  const clearCart = useCallback(() => runMutation('/cart', 'DELETE'), [runMutation])

  const itemCount = useMemo(() => cart?.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0) || 0, [cart])
  const value = useMemo(() => ({
    cart,
    status,
    error,
    pending,
    itemCount,
    refreshCart,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
  }), [cart, status, error, pending, itemCount, refreshCart, addItem, updateQuantity, removeItem, clearCart])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const cartContext = useContext(CartContext)
  if (!cartContext) throw new Error('useCart must be used within CartProvider.')
  return cartContext
}
