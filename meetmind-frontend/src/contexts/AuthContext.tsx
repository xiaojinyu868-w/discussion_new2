import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'
import type { User, AuthState } from '@/types'
import { authApi } from '@/services/api'

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<boolean>
  register: (email: string, password: string, name: string) => Promise<boolean>
  logout: () => void
  updateUser: (user: User) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
  })

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userStr = localStorage.getItem('user')
    
    if (token && userStr) {
      const user = JSON.parse(userStr) as User
      setState({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
      })
    } else {
      setState(prev => ({ ...prev, isLoading: false }))
    }
  }, [])

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setState(prev => ({ ...prev, isLoading: true }))
    
    const response = await authApi.login(email, password)
    
    if (response.data.success && response.data.data) {
      const { token, user } = response.data.data
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))
      setState({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
      })
      return true
    }
    
    setState(prev => ({ ...prev, isLoading: false }))
    return false
  }, [])

  const register = useCallback(async (email: string, password: string, name: string): Promise<boolean> => {
    setState(prev => ({ ...prev, isLoading: true }))
    
    const response = await authApi.register(email, password, name)
    
    if (response.data.success && response.data.data) {
      const { token, user } = response.data.data
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))
      setState({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
      })
      return true
    }
    
    setState(prev => ({ ...prev, isLoading: false }))
    return false
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    })
  }, [])

  const updateUser = useCallback((user: User) => {
    localStorage.setItem('user', JSON.stringify(user))
    setState(prev => ({ ...prev, user }))
  }, [])

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
