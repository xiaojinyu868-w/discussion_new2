import { useState, useRef, useCallback, useEffect } from 'react'

interface UseWebSocketOptions {
  url: string
  onMessage?: (data: unknown) => void
  onOpen?: () => void
  onClose?: () => void
  onError?: (error: Event) => void
  reconnect?: boolean
  reconnectInterval?: number
  maxReconnectAttempts?: number
}

interface UseWebSocketReturn {
  isConnected: boolean
  isConnecting: boolean
  send: (data: unknown) => void
  connect: () => void
  disconnect: () => void
}

export function useWebSocket(options: UseWebSocketOptions): UseWebSocketReturn {
  const {
    url,
    onMessage,
    onOpen,
    onClose,
    onError,
    reconnect = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
  } = options

  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const reconnectTimeoutRef = useRef<number | null>(null)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    setIsConnecting(true)
    
    const token = localStorage.getItem('token')
    const wsUrl = token ? `${url}?token=${token}` : url
    
    wsRef.current = new WebSocket(wsUrl)

    wsRef.current.onopen = () => {
      setIsConnected(true)
      setIsConnecting(false)
      reconnectAttemptsRef.current = 0
      onOpen?.()
    }

    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data)
      onMessage?.(data)
    }

    wsRef.current.onclose = () => {
      setIsConnected(false)
      setIsConnecting(false)
      onClose?.()

      // Attempt reconnection
      if (reconnect && reconnectAttemptsRef.current < maxReconnectAttempts) {
        reconnectAttemptsRef.current++
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connect()
        }, reconnectInterval)
      }
    }

    wsRef.current.onerror = (error) => {
      setIsConnecting(false)
      onError?.(error)
    }
  }, [url, onMessage, onOpen, onClose, onError, reconnect, reconnectInterval, maxReconnectAttempts])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
    reconnectAttemptsRef.current = maxReconnectAttempts // Prevent reconnection
    wsRef.current?.close()
    wsRef.current = null
    setIsConnected(false)
  }, [maxReconnectAttempts])

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    } else {
      console.error('WebSocket is not connected')
    }
  }, [])

  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  return {
    isConnected,
    isConnecting,
    send,
    connect,
    disconnect,
  }
}
