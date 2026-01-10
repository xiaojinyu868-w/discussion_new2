import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '@/contexts/AppContext'
import { useRecorder } from '@/hooks/useRecorder'
import { useToast } from '@/hooks/use-toast'
import { getScenarioConfig } from '@/config/scenarios'
import { sessionApi, skillApi } from '@/services/api'
import { formatDuration, generateId, cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import type { TranscriptionSegment, ChatMessage, Insight } from '@/types'
import { 
  ArrowLeft, 
  GraduationCap, 
  Briefcase, 
  Clock, 
  FileText,
  Sparkles,
  MessageCircle,
  Mic,
  Square,
  Pause,
  Play,
  Send,
  Loader2,
  Bot,
  User,
  Zap,
  ChevronDown,
  Volume2,
  Radio
} from 'lucide-react'

export default function RecorderPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { scenario, addInsight, insights, clearInsights } = useApp()
  
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [transcriptions, setTranscriptions] = useState<TranscriptionSegment[]>([])
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [loadingSkill, setLoadingSkill] = useState<string | null>(null)
  const [isChatLoading, setIsChatLoading] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [showSkillMenu, setShowSkillMenu] = useState(false)
  
  const transcriptScrollRef = useRef<HTMLDivElement>(null)
  const insightScrollRef = useRef<HTMLDivElement>(null)
  const chatScrollRef = useRef<HTMLDivElement>(null)

  const scenarioConfig = getScenarioConfig(scenario)
  const ScenarioIcon = scenario === 'classroom' ? GraduationCap : Briefcase

  // Handle new transcription segments from backend
  const handleTranscription = useCallback((segments: Array<{ id: string; text: string; speakerId?: string }>) => {
    const newSegments: TranscriptionSegment[] = segments.map(seg => ({
      id: seg.id || generateId(),
      text: seg.text,
      startTime: 0,
      endTime: 0,
      speaker: seg.speakerId || '发言者',
    }))
    setTranscriptions(prev => [...prev, ...newSegments])
  }, [])

  const {
    isRecording,
    isPaused,
    duration,
    audioLevel,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
  } = useRecorder({
    sessionId,
    onTranscription: handleTranscription,
  })

  // Auto-scroll transcriptions
  useEffect(() => {
    if (transcriptScrollRef.current) {
      transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight
    }
  }, [transcriptions])

  // Auto-scroll insights
  useEffect(() => {
    if (insightScrollRef.current) {
      insightScrollRef.current.scrollTop = insightScrollRef.current.scrollHeight
    }
  }, [insights])

  // Auto-scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
    }
  }, [chatMessages])

  // Create session when starting recording
  const handleStartRecording = useCallback(async () => {
    try {
      const response = await sessionApi.create(scenario)
      const data = response.data as unknown as { sessionId: string }
      if (data.sessionId) {
        setSessionId(data.sessionId)
        clearInsights()
        setTranscriptions([])
        setChatMessages([])
        // Pass sessionId directly to startRecording to avoid timing issues
        await startRecording(data.sessionId)
        toast({
          title: '🎙️ 录音已开始',
          description: `${scenarioConfig.name}模式已激活`,
        })
      }
    } catch (error) {
      console.error('Failed to create session:', error)
      toast({
        title: '创建会话失败',
        description: '请检查网络连接后重试',
        variant: 'destructive',
      })
    }
  }, [scenario, scenarioConfig.name, startRecording, clearInsights, toast])

  const handleStopRecording = useCallback(async () => {
    const blob = await stopRecording()
    if (blob && sessionId) {
      try {
        await sessionApi.end(sessionId)
        toast({
          title: '✅ 录音已结束',
          description: `录音时长: ${formatDuration(duration)}`,
        })
      } catch (error) {
        console.error('Failed to end session:', error)
      }
    }
  }, [stopRecording, sessionId, duration, toast])

  // Trigger AI skill
  const handleTriggerSkill = useCallback(async (skillId: string) => {
    if (!sessionId) return
    
    setLoadingSkill(skillId)
    setShowSkillMenu(false)
    try {
      const response = await skillApi.trigger(sessionId, skillId, scenario)
      const data = response.data as unknown as { cards?: Array<{ type: string; content: unknown }> }
      
      if (data.cards && data.cards.length > 0) {
        data.cards.forEach((card) => {
          const insight: Insight = {
            id: generateId(),
            type: card.type,
            content: card.content as Record<string, unknown>,
            createdAt: new Date().toISOString(),
            sessionId,
          }
          addInsight(insight)
        })
        toast({
          title: '✨ AI 分析完成',
        })
      }
    } catch (error) {
      console.error('Skill trigger failed:', error)
      toast({
        title: '分析失败',
        description: '请稍后重试',
        variant: 'destructive',
      })
    }
    setLoadingSkill(null)
  }, [sessionId, scenario, addInsight, toast])

  // Send chat message
  const handleSendMessage = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!sessionId || !chatInput.trim() || isChatLoading) return

    const content = chatInput.trim()
    setChatInput('')

    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    }
    setChatMessages(prev => [...prev, userMessage])

    const assistantMessage: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      isLoading: true,
    }
    setChatMessages(prev => [...prev, assistantMessage])
    setIsChatLoading(true)

    try {
      const response = await sessionApi.askQuestion(sessionId, content, scenario)
      const data = response.data as unknown as { answer?: string }
      
      setChatMessages(prev =>
        prev.map(msg =>
          msg.id === assistantMessage.id
            ? { ...msg, content: data.answer || '抱歉，无法获取回答', isLoading: false }
            : msg
        )
      )
    } catch (error) {
      setChatMessages(prev =>
        prev.map(msg =>
          msg.id === assistantMessage.id
            ? { ...msg, content: '抱歉，处理问题时出错了', isLoading: false }
            : msg
        )
      )
    }
    setIsChatLoading(false)
  }, [sessionId, chatInput, isChatLoading, scenario])

  // Audio level bars
  const levelBars = Array.from({ length: 12 }, (_, i) => {
    const threshold = (i + 1) / 12
    const isActive = audioLevel > threshold * 0.8
    return isActive
  })

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Compact Header with Recording Controls */}
      <header className="flex-shrink-0 px-4 py-3 border-b border-white/5 bg-black/20 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          {/* Left: Back & Scenario */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${scenarioConfig.color}30` }}
              >
                <ScenarioIcon className="w-4 h-4" style={{ color: scenarioConfig.color }} />
              </div>
              <span className="font-semibold text-white">{scenarioConfig.name}</span>
            </div>
          </div>

          {/* Center: Recording Controls */}
          <div className="flex items-center gap-3">
            {/* Audio Level Indicator */}
            <div className="flex items-center gap-0.5 h-6 px-2">
              {levelBars.map((isActive, i) => (
                <div
                  key={i}
                  className={cn(
                    'w-1 rounded-full transition-all duration-75',
                    isActive ? 'bg-green-400' : 'bg-white/10'
                  )}
                  style={{
                    height: `${Math.min(24, 8 + i * 1.5)}px`,
                    opacity: isActive ? 1 : 0.3,
                  }}
                />
              ))}
            </div>

            {/* Main Recording Button */}
            {!isRecording ? (
              <button
                onClick={handleStartRecording}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-400 hover:to-rose-400 text-white font-medium shadow-lg shadow-red-500/25 transition-all hover:scale-105"
              >
                <Mic className="w-4 h-4" />
                <span>开始录音</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                {isPaused ? (
                  <button
                    onClick={resumeRecording}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-green-500 hover:bg-green-400 text-white font-medium transition-all"
                  >
                    <Play className="w-4 h-4" />
                    <span>继续</span>
                  </button>
                ) : (
                  <button
                    onClick={pauseRecording}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500 hover:bg-amber-400 text-white font-medium transition-all"
                  >
                    <Pause className="w-4 h-4" />
                    <span>暂停</span>
                  </button>
                )}
                <button
                  onClick={handleStopRecording}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white font-medium transition-all"
                >
                  <Square className="w-4 h-4" />
                  <span>结束</span>
                </button>
              </div>
            )}

            {/* Duration */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5">
              <Clock className="w-4 h-4 text-violet-400" />
              <span className="font-mono text-white tabular-nums">
                {formatDuration(duration)}
              </span>
            </div>
          </div>

          {/* Right: Recording Status & AI Skills */}
          <div className="flex items-center gap-3">
            {/* AI Skills Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowSkillMenu(!showSkillMenu)}
                disabled={!sessionId}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg transition-all',
                  sessionId 
                    ? 'bg-violet-500/20 hover:bg-violet-500/30 text-violet-300' 
                    : 'bg-white/5 text-white/30 cursor-not-allowed'
                )}
              >
                <Zap className="w-4 h-4" />
                <span className="text-sm font-medium">AI 技能</span>
                <ChevronDown className={cn('w-4 h-4 transition-transform', showSkillMenu && 'rotate-180')} />
              </button>
              
              {showSkillMenu && sessionId && (
                <div className="absolute top-full right-0 mt-2 w-48 py-2 rounded-xl bg-slate-800 border border-white/10 shadow-xl z-50">
                  {scenarioConfig.skills.map((skill) => (
                    <button
                      key={skill.id}
                      onClick={() => handleTriggerSkill(skill.id)}
                      disabled={loadingSkill === skill.id}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 text-left transition-colors"
                    >
                      <span className="text-lg">{skill.icon}</span>
                      <span className="text-sm text-white/80">{skill.name}</span>
                      {loadingSkill === skill.id && (
                        <Loader2 className="w-4 h-4 animate-spin ml-auto text-violet-400" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Recording Status Indicator */}
            {isRecording && (
              <div className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium',
                isPaused ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'
              )}>
                <Radio className={cn('w-3.5 h-3.5', !isPaused && 'animate-pulse')} />
                <span>{isPaused ? '已暂停' : '录音中'}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content - Three Column Layout */}
      <div className="flex-1 flex gap-4 p-4 overflow-hidden">
        {/* Column 1: Transcription */}
        <div className="flex-1 flex flex-col min-w-0 rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-white/[0.02]">
            <FileText className="w-4 h-4 text-blue-400" />
            <span className="font-medium text-white">实时转写</span>
            {isRecording && !isPaused && (
              <span className="flex items-center gap-1 ml-auto text-xs text-green-400">
                <Volume2 className="w-3 h-3 animate-pulse" />
                转写中
              </span>
            )}
          </div>
          
          <ScrollArea className="flex-1">
            <div ref={transcriptScrollRef} className="p-4 space-y-3">
              {transcriptions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-white/30">
                  <FileText className="w-10 h-10 mb-3 opacity-50" />
                  <p className="text-sm">开始录音后显示转写内容</p>
                </div>
              ) : (
                transcriptions.map((segment, index) => (
                  <div
                    key={segment.id}
                    className={cn(
                      'p-3 rounded-xl bg-white/[0.03] border-l-2 transition-all',
                      index === transcriptions.length - 1 ? 'border-blue-400 bg-blue-500/5' : 'border-transparent'
                    )}
                  >
                    {segment.speaker && (
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="w-5 h-5 rounded-full bg-blue-500/30 flex items-center justify-center text-[10px] font-medium text-blue-300">
                          {segment.speaker.charAt(0)}
                        </div>
                        <span className="text-xs font-medium text-white/60">{segment.speaker}</span>
                        <span className="text-xs text-white/30">
                          {Math.floor(segment.startTime / 60)}:{String(Math.floor(segment.startTime % 60)).padStart(2, '0')}
                        </span>
                      </div>
                    )}
                    <p className="text-sm text-white/80 leading-relaxed">{segment.text}</p>
                  </div>
                ))
              )}
              
              {isRecording && !isPaused && (
                <div className="flex items-center gap-2 px-3 py-2 text-white/40">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span className="text-xs">正在转写...</span>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Column 2: AI Insights */}
        <div className="flex-1 flex flex-col min-w-0 rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-white/[0.02]">
            <Sparkles className="w-4 h-4 text-violet-400" />
            <span className="font-medium text-white">AI 洞察</span>
            {insights.length > 0 && (
              <span className="ml-auto px-2 py-0.5 rounded-full bg-violet-500/20 text-xs font-medium text-violet-300">
                {insights.length}
              </span>
            )}
          </div>
          
          <ScrollArea className="flex-1">
            <div ref={insightScrollRef} className="p-4 space-y-3">
              {insights.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-white/30">
                  <Sparkles className="w-10 h-10 mb-3 opacity-50" />
                  <p className="text-sm text-center">
                    点击「AI 技能」生成洞察
                  </p>
                </div>
              ) : (
                insights.map((insight) => (
                  <div
                    key={insight.id}
                    className="p-4 rounded-xl bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 border border-violet-500/20"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 rounded-md bg-violet-500/20 text-xs font-medium text-violet-300">
                        {insight.type}
                      </span>
                      <span className="text-xs text-white/30">
                        {new Date(insight.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-sm text-white/80">
                      {typeof insight.content === 'string' 
                        ? insight.content 
                        : JSON.stringify(insight.content, null, 2)}
                    </div>
                  </div>
                ))
              )}
              
              {loadingSkill && (
                <div className="flex items-center justify-center gap-2 py-4 text-violet-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">AI 正在分析...</span>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Column 3: Chat */}
        <div className="flex-1 flex flex-col min-w-0 rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-white/[0.02]">
            <MessageCircle className="w-4 h-4 text-emerald-400" />
            <span className="font-medium text-white">智能问答</span>
          </div>
          
          <ScrollArea className="flex-1">
            <div ref={chatScrollRef} className="p-4 space-y-4">
              {chatMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-white/30">
                  <MessageCircle className="w-10 h-10 mb-3 opacity-50" />
                  <p className="text-sm text-center">
                    {scenario === 'classroom'
                      ? '询问关于课堂内容的问题'
                      : '询问关于会议内容的问题'}
                  </p>
                </div>
              ) : (
                chatMessages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      'flex gap-2',
                      message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                    )}
                  >
                    <div
                      className={cn(
                        'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0',
                        message.role === 'user' ? 'bg-emerald-500' : 'bg-slate-700'
                      )}
                    >
                      {message.role === 'user' ? (
                        <User className="w-3.5 h-3.5 text-white" />
                      ) : (
                        <Bot className="w-3.5 h-3.5 text-slate-300" />
                      )}
                    </div>
                    <div
                      className={cn(
                        'max-w-[85%] px-3 py-2 rounded-xl text-sm',
                        message.role === 'user'
                          ? 'bg-emerald-500 text-white'
                          : 'bg-white/5 text-white/80'
                      )}
                    >
                      {message.isLoading ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span className="text-xs">思考中...</span>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Chat Input */}
          <form onSubmit={handleSendMessage} className="p-3 border-t border-white/5">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={scenario === 'classroom' ? '问问课堂内容...' : '问问会议内容...'}
                disabled={!sessionId || isChatLoading}
                className="flex-1 h-10 px-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50 transition-all disabled:opacity-50"
              />
              <Button
                type="submit"
                disabled={!chatInput.trim() || !sessionId || isChatLoading}
                className="h-10 w-10 rounded-xl bg-emerald-500 hover:bg-emerald-400 p-0"
              >
                {isChatLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
