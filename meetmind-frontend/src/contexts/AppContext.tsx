import { createContext, useContext, useState, ReactNode, useCallback } from 'react'
import type { ScenarioType, Session, Insight, ChatMessage, TranscriptionSegment } from '@/types'

interface AppState {
  scenario: ScenarioType
  currentSession: Session | null
  transcriptions: TranscriptionSegment[]
  insights: Insight[]
  chatMessages: ChatMessage[]
  isAgentRunning: boolean
  isConnected: boolean
}

interface AppContextType extends AppState {
  setScenario: (scenario: ScenarioType) => void
  setCurrentSession: (session: Session | null) => void
  addTranscription: (segment: TranscriptionSegment) => void
  clearTranscriptions: () => void
  addInsight: (insight: Insight) => void
  clearInsights: () => void
  addChatMessage: (message: ChatMessage) => void
  updateChatMessage: (id: string, content: string) => void
  clearChatMessages: () => void
  setAgentRunning: (running: boolean) => void
  setConnected: (connected: boolean) => void
  resetState: () => void
}

const initialState: AppState = {
  scenario: 'meeting',
  currentSession: null,
  transcriptions: [],
  insights: [],
  chatMessages: [],
  isAgentRunning: false,
  isConnected: false,
}

const AppContext = createContext<AppContextType | undefined>(undefined)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialState)

  const setScenario = useCallback((scenario: ScenarioType) => {
    setState(prev => ({ ...prev, scenario }))
  }, [])

  const setCurrentSession = useCallback((session: Session | null) => {
    setState(prev => ({ ...prev, currentSession: session }))
  }, [])

  const addTranscription = useCallback((segment: TranscriptionSegment) => {
    setState(prev => ({
      ...prev,
      transcriptions: [...prev.transcriptions, segment],
    }))
  }, [])

  const clearTranscriptions = useCallback(() => {
    setState(prev => ({ ...prev, transcriptions: [] }))
  }, [])

  const addInsight = useCallback((insight: Insight) => {
    setState(prev => ({
      ...prev,
      insights: [...prev.insights, insight],
    }))
  }, [])

  const clearInsights = useCallback(() => {
    setState(prev => ({ ...prev, insights: [] }))
  }, [])

  const addChatMessage = useCallback((message: ChatMessage) => {
    setState(prev => ({
      ...prev,
      chatMessages: [...prev.chatMessages, message],
    }))
  }, [])

  const updateChatMessage = useCallback((id: string, content: string) => {
    setState(prev => ({
      ...prev,
      chatMessages: prev.chatMessages.map(msg =>
        msg.id === id ? { ...msg, content, isLoading: false } : msg
      ),
    }))
  }, [])

  const clearChatMessages = useCallback(() => {
    setState(prev => ({ ...prev, chatMessages: [] }))
  }, [])

  const setAgentRunning = useCallback((running: boolean) => {
    setState(prev => ({ ...prev, isAgentRunning: running }))
  }, [])

  const setConnected = useCallback((connected: boolean) => {
    setState(prev => ({ ...prev, isConnected: connected }))
  }, [])

  const resetState = useCallback(() => {
    setState(initialState)
  }, [])

  return (
    <AppContext.Provider
      value={{
        ...state,
        setScenario,
        setCurrentSession,
        addTranscription,
        clearTranscriptions,
        addInsight,
        clearInsights,
        addChatMessage,
        updateChatMessage,
        clearChatMessages,
        setAgentRunning,
        setConnected,
        resetState,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider')
  }
  return context
}
