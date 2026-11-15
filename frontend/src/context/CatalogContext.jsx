import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import api from '../api/client.js'
import { productImagesBySku } from '../data/catalog-assets.js'

const CatalogContext = createContext(null)

const endpoints = {
  products: '/products',
  categories: '/categories',
  brands: '/brands',
  promotions: '/promotions',
}

const makeResource = (status = 'loading') => ({ data: [], status, error: null })

function readCollection(response, resourceName) {
  if (!response?.success || !Array.isArray(response.data)) {
    throw new Error(`Backend trả về dữ liệu ${resourceName} không hợp lệ.`)
  }
  return response.data
}

export function CatalogProvider({ children }) {
  const [resources, setResources] = useState(() => ({
    products: makeResource(),
    categories: makeResource(),
    brands: makeResource(),
    promotions: makeResource(),
  }))

  useEffect(() => {
    const controller = new AbortController()

    for (const [resourceName, path] of Object.entries(endpoints)) {
      api.get(path, { signal: controller.signal })
        .then((response) => readCollection(response, resourceName))
        .then((data) => {
          if (resourceName === 'products') {
            return data.filter((product) => product.isActive === true)
          }
          return data
        })
        .then((data) => {
          setResources((current) => ({
            ...current,
            [resourceName]: { data, status: 'success', error: null },
          }))
        })
        .catch((error) => {
          if (error?.name === 'AbortError' || controller.signal.aborted) return
          setResources((current) => ({
            ...current,
            [resourceName]: {
              data: [],
              status: 'error',
              error: error?.message || `Không thể tải ${resourceName} từ Backend.`,
            },
          }))
        })
    }

    return () => controller.abort()
  }, [])

  const refreshTaxonomies = useCallback(async () => {
    await Promise.all(['categories', 'brands'].map(async (resourceName) => {
      try {
        const data = readCollection(await api.get(endpoints[resourceName]), resourceName)
        setResources((current) => ({
          ...current,
          [resourceName]: { data, status: 'success', error: null },
        }))
      } catch (error) {
        setResources((current) => ({
          ...current,
          [resourceName]: {
            data: [],
            status: 'error',
            error: error?.message || `Không thể tải ${resourceName} từ Backend.`,
          },
        }))
      }
    }))
  }, [])

  const categoriesById = useMemo(
    () => new Map(resources.categories.data.map((category) => [category.categoryId, category])),
    [resources.categories.data],
  )
  const brandsById = useMemo(
    () => new Map(resources.brands.data.map((brand) => [brand.brandId, brand])),
    [resources.brands.data],
  )

  const products = useMemo(() => resources.products.data.map((product) => ({
    ...product,
    id: product.productId,
    name: product.productName,
    price: Number(product.unitPrice),
    brand: brandsById.get(product.brandId)?.brandName || '',
    category: categoriesById.get(product.categoryId)?.categoryName || '',
    image: product.imageUrl || productImagesBySku[product.sku] || null,
    imageAlt: product.productName,
    isOutOfStock: Number(product.stockQuantity) <= 0,
  })), [resources.products.data, categoriesById, brandsById])

  const value = useMemo(() => ({
    products,
    categories: resources.categories.data,
    brands: resources.brands.data,
    promotions: resources.promotions.data,
    resources,
    refreshTaxonomies,
  }), [products, resources, refreshTaxonomies])

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
}

export function useCatalog() {
  const catalog = useContext(CatalogContext)
  if (!catalog) throw new Error('useCatalog must be used within CatalogProvider.')
  return catalog
}
