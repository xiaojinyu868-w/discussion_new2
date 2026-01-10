import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'
import type { ApiResponse } from '@/types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 请求拦截器
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token')
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error: AxiosError) => {
    console.error('Request error:', error)
    return Promise.reject(error)
  }
)

// 响应拦截器
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiResponse>) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    console.error('Response error:', error.response?.data?.error || error.message)
    return Promise.reject(error)
  }
)

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    api.post<ApiResponse<{ token: string; user: { id: string; email: string; name: string } }>>(
      '/auth/login',
      { email, password }
    ),
  
  register: (email: string, password: string, name: string) =>
    api.post<ApiResponse<{ token: string; user: { id: string; email: string; name: string } }>>(
      '/auth/register',
      { email, password, name }
    ),
  
  logout: () => api.post('/auth/logout'),
  
  getProfile: () => api.get<ApiResponse<{ id: string; email: string; name: string }>>('/auth/profile'),
}

// Session API
export const sessionApi = {
  create: (scenario: string) =>
    api.post<ApiResponse<{ sessionId: string }>>('/sessions', { meetingId: `${scenario}-${Date.now()}` }),
  
  end: (sessionId: string) =>
    api.post<ApiResponse>(`/sessions/${sessionId}/complete`),
  
  getHistory: (page = 1, limit = 10) =>
    api.get<ApiResponse<{ sessions: Array<{
      id: string
      title: string
      scenario: string
      status: string
      createdAt: string
      duration: number
    }>; total: number }>>('/auth/meetings', { params: { page, limit } }),
  
  getDetail: (sessionId: string) =>
    api.get<ApiResponse>(`/sessions/${sessionId}/transcripts`),
  
  askQuestion: (sessionId: string, question: string, scenario: string) =>
    api.post<ApiResponse<{ answer: string }>>(`/sessions/${sessionId}/qa`, { question, scenario }),
  
  getSummaries: (sessionId: string) =>
    api.get<ApiResponse<{ summaries: Array<{
      id: string
      type: string
      content: string
      keyPoints: string[]
      createdAt: string
    }> }>>(`/sessions/${sessionId}/summaries`),
}

// Skill API - 使用后端的 sessions/:id/skills/:skillType 路由
export const skillApi = {
  trigger: (sessionId: string, skillType: string, scenario: string) =>
    api.post<ApiResponse<{ cards: unknown[] }>>(`/sessions/${sessionId}/skills/${skillType}`, {
      scenario,
    }),
}

// Quota API
export const quotaApi = {
  get: () =>
    api.get<ApiResponse<{ used: number; total: number; remaining: number }>>('/quota'),
}

// Transcription API
export const transcriptionApi = {
  uploadAudio: (sessionId: string, audioBlob: Blob) => {
    const formData = new FormData()
    formData.append('audio', audioBlob, 'recording.webm')
    formData.append('sessionId', sessionId)
    return api.post<ApiResponse<{ text: string }>>('/transcription/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}

export default api
