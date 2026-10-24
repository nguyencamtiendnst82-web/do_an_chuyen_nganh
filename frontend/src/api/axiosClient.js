import axios from 'axios'

const axiosClient = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor: tự động gắn Authorization: Bearer <token>
axiosClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Danh sách các endpoint KHÔNG xử lý 401 tự động
// (tránh xóa token khi trang đăng nhập nhận lỗi sai thông tin)
const AUTH_WHITELIST = ['/auth/login', '/auth/register']

// Response interceptor: bắt 401 → xóa token, redirect login
// NGOẠI TRỪ các endpoint trong AUTH_WHITELIST
axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const requestUrl = error.config?.url || ''
      const isWhitelisted = AUTH_WHITELIST.some((path) => requestUrl.includes(path))

      if (!isWhitelisted) {
        // Token hết hạn hoặc không hợp lệ → xóa và redirect
        localStorage.removeItem('token')
        window.location.href = '/login'
      }
      // Nếu là whitelist (login/register) → để lỗi đi qua bình thường
    }
    return Promise.reject(error)
  }
)

export default axiosClient
