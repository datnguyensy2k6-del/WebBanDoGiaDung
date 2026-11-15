export const productImagesBySku = Object.freeze({
  'HN-AIR-001': '/images/air-fryer.jpg',
  'HN-VAC-001': '/images/vacuum.jpg',
  'HN-COF-001': '/images/kettle.jpg',
  'HN-BLD-001': '/images/cookware.jpg',
  'HN-RBT-001': '/images/robot-vacuum.jpg',
  'HN-COO-001': '/images/electric-cooker.jpg',
  'HN-AIR-002': '/images/air-purifier-real.jpg',
  'HN-BOX-001': '/images/food-container.jpg',
  'HN-FAN-001': '/images/fan-real.jpg',
})

export const categoryImagesBySlug = Object.freeze({
  'nha-bep': '/images/air-fryer.jpg',
  'cham-soc-nha-cua': '/images/vacuum.jpg',
  'thiet-bi-lam-mat': '/images/fan-real.jpg',
  'do-dung-gia-dinh': '/images/food-container.jpg',
  'may-loc-khong-khi': '/images/air-purifier-real.jpg',
})

export function formatVnd(value) {
  const amount = Number(value)
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0)
}
