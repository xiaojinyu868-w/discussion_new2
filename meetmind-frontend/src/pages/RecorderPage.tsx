import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '@/contexts/AppContext'
import { useRecorder } from '@/hooks/useRecorder'
import { useToast } from '@/hooks/use-toast'
import { getScenarioConfig, getAlignmentTarget } from '@/config/scenarios'
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
  Radio,
  Brain,
  Lightbulb,
  Target,
  Link2,
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
  const [activeLayer, setActiveLayer] = useState<'L1' | 'L2' | 'L3' | 'L4'>('L1')
  
  const transcriptScrollRef = useRef<HTMLDivElement>(null)
  const insightScrollRef = useRef<HTMLDivElement>(null)
  const chatScrollRef = useRef<HTMLDivElement>(null)

  const scenarioConfig = getScenarioConfig(scenario)
  const alignmentTarget = getAlignmentTarget(scenario)
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
          title: '🎯 认知对齐已启动',
          description: `${scenarioConfig.name} · 正在对齐${alignmentTarget}`,
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
          title: '✅ 会议记录完成',
          description: `录音时长: ${formatDuration(duration)}`,
        })
      } catch (error) {
        console.error('Failed to end session:', error)
      }
    }
  }, [stopRecording, sessionId, duration, toast])

  const handleTriggerSkill = useCallback(async (skillId: string) => {
    if (!sessionId || loadingSkill) return
    
    setLoadingSkill(skillId)
    setShowSkillMenu(false)
    
    try {
      const response = await skillApi.trigger(sessionId, skillId, scenario)
      const data = response.data as unknown as { cards?: unknown[] }
      
      if (data.cards && Array.isArray(data.cards)) {
        data.cards.forEach((card: unknown) => {
          const cardData = card as { title?: string; content?: string; type?: string }
          addInsight({
            id: generateId(),
            type: skillId,
            title: cardData.title || '洞察',
            content: cardData.content || '',
            timestamp: new Date(),
          })
        })
      }
      
      toast({
        title: '✨ 认知对齐技能已触发',
        description: `${scenarioConfig.skills.find(s => s.id === skillId)?.name || skillId}`,
      })
    } catch (error) {
      console.error('Failed to trigger skill:', error)
      toast({
        title: '技能触发失败',
        variant: 'destructive',
      })
    } finally {
      setLoadingSkill(null)
    }
  }, [sessionId, loadingSkill, scenario, scenarioConfig.skills, addInsight, toast])

  const handleSendMessage = useCallback(async () => {
    if (!sessionId || !chatInput.trim() || isChatLoading) return
    
    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: chatInput.trim(),
      timestamp: new Date(),
    }
    
    setChatMessages(prev => [...prev, userMessage])
    setChatInput('')
    setIsChatLoading(true)
    
    try {
      const response = await sessionApi.askQuestion(sessionId, userMessage.content, scenario)
      const data = response.data as unknown as { answer?: string }
      
      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: data.answer || '抱歉，我无法回答这个问题。',
        timestamp: new Date(),
      }
      
      setChatMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('Failed to send message:', error)
      const errorMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: '抱歉，发生了错误，请稍后重试。',
        timestamp: new Date(),
      }
      setChatMessages(prev => [...prev, errorMessage])
    }
    
    setIsChatLoading(false)
  }, [sessionId, chatInput, isChatLoading, scenario])

  // Audio level bars
  const levelBars = Array.from({ length: 12 }, (_, i) => {
    const threshold = (i + 1) / 12
    const isActive = audioLevel > threshold * 0.8
    return isActive
  })

  // 认知对齐层级配置
  const alignmentLayers = [
    { id: 'L1', name: '信息采集', subtitle: '全息记录', icon: Radio, color: '#00d4ff' },
    { id: 'L2', name: '认知对齐', subtitle: `对齐${alignmentTarget}`, icon: Link2, color: '#a855f7' },
    { id: 'L3', name: '深度理解', subtitle: '洞察意图', icon: Brain, color: '#f59e0b' },
    { id: 'L4', name: '行动建议', subtitle: '决策支撑', icon: Lightbulb, color: '#00ffc8' },
  ]

  // 获取洞察类型的图标和颜色 - 体现对齐理念
  const getInsightStyle = (type: string) => {
    switch (type) {
      case 'inner_os':
        return { icon: Link2, color: '#00d4ff', label: `对齐${alignmentTarget}` }
      case 'brainstorm':
        return { icon: Lightbulb, color: '#f59e0b', label: '拓展视角' }
      case 'stop_talking':
        return { icon: Target, color: '#ff6b9d', label: '目标守护' }
      default:
        return { icon: Sparkles, color: '#00d4ff', label: '认知洞察' }
    }
  }

  return (
    <div className="h-screen flex flex-col bg-slate-950 overflow-hidden">
      {/* 极光背景 */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-violet-500/5 rounded-full blur-[80px]" />
        {isRecording && !isPaused && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[120px] animate-pulse" />
        )}
      </div>

      {/* 顶部控制栏 */}
      <div className="relative z-20 flex-shrink-0 border-b border-white/[0.06] bg-slate-900/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-6 py-4">
          {/* 左侧：返回 + 场景信息 */}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/dashboard')}
              className="text-white/60 hover:text-white hover:bg-white/10 rounded-xl"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: `${scenarioConfig.color}20` }}
              >
                <ScenarioIcon className="w-5 h-5" style={{ color: scenarioConfig.color }} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">{scenarioConfig.name}模式</span>
                  {isRecording && (
                    <span className={cn(
                      'px-2 py-0.5 rounded-full text-xs font-medium',
                      isPaused 
                        ? 'bg-amber-500/20 text-amber-400' 
                        : 'bg-red-500/20 text-red-400'
                    )}>
                      {isPaused ? '已暂停' : '录音中'}
                    </span>
                  )}
                </div>
                <span className="text-sm text-white/40">认知对齐 · 对齐{alignmentTarget}</span>
              </div>
            </div>
          </div>

          {/* 中间：录音控制 */}
          <div className="flex items-center gap-4">
            {/* 音量指示器 */}
            {isRecording && (
              <div className="flex items-center gap-1 px-3 py-2 rounded-xl bg-white/5">
                <Volume2 className="w-4 h-4 text-white/40 mr-1" />
                {levelBars.map((active, i) => (
                  <div
                    key={i}
                    className={cn(
                      'w-1 rounded-full transition-all duration-75',
                      active ? 'bg-cyan-400' : 'bg-white/10'
                    )}
                    style={{ height: `${8 + i * 2}px` }}
                  />
                ))}
              </div>
            )}

            {/* 时长 */}
            {isRecording && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5">
                <Clock className="w-4 h-4 text-white/40" />
                <span className="font-mono text-white/80 text-lg">{formatDuration(duration)}</span>
              </div>
            )}

            {/* 录音按钮组 */}
            <div className="flex items-center gap-2">
              {!isRecording ? (
                <Button
                  onClick={handleStartRecording}
                  className={cn(
                    'h-12 px-6 rounded-xl font-semibold',
                    'bg-gradient-to-r from-cyan-500 to-violet-500',
                    'hover:from-cyan-400 hover:to-violet-400',
                    'text-white shadow-lg shadow-cyan-500/20'
                  )}
                >
                  <Mic className="w-5 h-5 mr-2" />
                  开始录音
                </Button>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={isPaused ? resumeRecording : pauseRecording}
                    className="w-12 h-12 rounded-xl bg-white/5 hover:bg-white/10 text-white/80"
                  >
                    {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                  </Button>
                  <Button
                    onClick={handleStopRecording}
                    className="h-12 px-6 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 font-semibold"
                  >
                    <Square className="w-4 h-4 mr-2" />
                    结束录音
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* 右侧：AI 技能 */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                onClick={() => setShowSkillMenu(!showSkillMenu)}
                disabled={!sessionId}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all',
                  sessionId 
                    ? 'bg-violet-500/20 hover:bg-violet-500/30 text-violet-300' 
                    : 'bg-white/5 text-white/30 cursor-not-allowed'
                )}
              >
                <Link2 className="w-4 h-4" />
                <span className="text-sm font-medium">对齐技能</span>
                <ChevronDown className={cn('w-4 h-4 transition-transform', showSkillMenu && 'rotate-180')} />
              </button>
              
              {showSkillMenu && sessionId && (
                <div className="absolute top-full right-0 mt-2 w-56 py-2 rounded-xl bg-slate-800/95 backdrop-blur-xl border border-white/10 shadow-2xl z-50">
                  <div className="px-3 py-2 border-b border-white/10">
                    <span className="text-xs text-white/40 font-medium">选择对齐技能</span>
                  </div>
                  {scenarioConfig.skills.map((skill) => (
                    <button
                      key={skill.id}
                      onClick={() => handleTriggerSkill(skill.id)}
                      disabled={loadingSkill === skill.id}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-left transition-colors"
                    >
                      <span className="text-xl">{skill.icon}</span>
                      <div className="flex-1">
                        <span className="text-sm text-white/90 font-medium">{skill.name}</span>
                        <p className="text-xs text-white/40">{skill.description}</p>
                      </div>
                      {loadingSkill === skill.id && (
                        <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 认知对齐层级标签 */}
        <div className="flex items-center gap-1 px-6 pb-3">
          {alignmentLayers.map((layer) => (
            <button
              key={layer.id}
              onClick={() => setActiveLayer(layer.id as 'L1' | 'L2' | 'L3' | 'L4')}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg transition-all',
                activeLayer === layer.id 
                  ? 'bg-white/10 text-white' 
                  : 'text-white/40 hover:text-white/60 hover:bg-white/5'
              )}
            >
              <layer.icon className="w-4 h-4" style={{ color: activeLayer === layer.id ? layer.color : undefined }} />
              <span className="text-sm font-medium">{layer.name}</span>
              <span className="text-xs opacity-60">· {layer.subtitle}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 主内容区 - 三栏布局 */}
      <div className="relative z-10 flex-1 flex overflow-hidden">
        {/* 左栏：实时转写 (L1 信息层) */}
        <div className="w-[35%] border-r border-white/[0.06] flex flex-col bg-slate-900/30">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
              <Radio className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">L1 · 全息记录</h3>
              <p className="text-xs text-white/40">实时语音转写</p>
            </div>
            {isRecording && !isPaused && (
              <div className="ml-auto flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-xs text-cyan-400">转写中</span>
              </div>
            )}
          </div>
          
          <ScrollArea className="flex-1" ref={transcriptScrollRef}>
            <div className="p-4 space-y-3">
              {transcriptions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 flex items-center justify-center mb-4">
                    <FileText className="w-8 h-8 text-cyan-500/40" />
                  </div>
                  <p className="text-white/40 text-sm">开始录音后</p>
                  <p className="text-white/40 text-sm">转写内容将在这里显示</p>
                </div>
              ) : (
                transcriptions.map((seg) => (
                  <div 
                    key={seg.id} 
                    className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium text-cyan-400">{seg.speaker}</span>
                      <span className="text-xs text-white/30">
                        {formatDuration(seg.startTime)}
                      </span>
                    </div>
                    <p className="text-white/80 text-sm leading-relaxed">{seg.text}</p>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* 中栏：AI 洞察 (L2-L4 认知/视觉/战略层) */}
        <div className="w-[35%] border-r border-white/[0.06] flex flex-col bg-slate-900/20">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
            <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
              <Link2 className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">认知对齐</h3>
              <p className="text-xs text-white/40">对齐{alignmentTarget} · 洞察意图</p>
            </div>
            {insights.length > 0 && (
              <span className="ml-auto px-2 py-0.5 rounded-full text-xs bg-violet-500/20 text-violet-300">
                {insights.length}
              </span>
            )}
          </div>
          
          <ScrollArea className="flex-1" ref={insightScrollRef}>
            <div className="p-4 space-y-3">
              {insights.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-4">
                    <Link2 className="w-8 h-8 text-violet-500/40" />
                  </div>
                  <p className="text-white/40 text-sm">触发对齐技能后</p>
                  <p className="text-white/40 text-sm">认知洞察将在这里显示</p>
                </div>
              ) : (
                insights.map((insight) => {
                  const style = getInsightStyle(insight.type)
                  return (
                    <div 
                      key={insight.id} 
                      className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-colors"
                      style={{ borderLeftColor: style.color, borderLeftWidth: 3 }}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <div 
                          className="w-6 h-6 rounded-md flex items-center justify-center"
                          style={{ background: `${style.color}20` }}
                        >
                          <style.icon className="w-3.5 h-3.5" style={{ color: style.color }} />
                        </div>
                        <span className="text-xs font-medium" style={{ color: style.color }}>{style.label}</span>
                        <span className="text-xs text-white/30 ml-auto">
                          {insight.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <h4 className="font-semibold text-white text-sm mb-2">{insight.title}</h4>
                      <p className="text-white/60 text-sm leading-relaxed whitespace-pre-wrap">{insight.content}</p>
                    </div>
                  )
                })
              )}
            </div>
          </ScrollArea>
        </div>

        {/* 右栏：记忆盒子 (上下文问答) */}
        <div className="flex-1 flex flex-col bg-slate-900/10">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <MessageCircle className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">深度对齐</h3>
              <p className="text-xs text-white/40">基于全量上下文的智能问答</p>
            </div>
          </div>
          
          <ScrollArea className="flex-1" ref={chatScrollRef}>
            <div className="p-4 space-y-4">
              {chatMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4">
                    <MessageCircle className="w-8 h-8 text-emerald-500/40" />
                  </div>
                  <p className="text-white/40 text-sm mb-4">随时提问，帮你深度对齐{alignmentTarget}</p>
                  <div className="space-y-2">
                    {['"刚才谁提到了预算？"', '"核心结论是什么？"'].map((q) => (
                      <button
                        key={q}
                        onClick={() => setChatInput(q.replace(/"/g, ''))}
                        disabled={!sessionId}
                        className="px-4 py-2 rounded-full text-xs bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70 transition-colors disabled:opacity-50"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      'flex gap-3',
                      msg.role === 'user' ? 'flex-row-reverse' : ''
                    )}
                  >
                    <div 
                      className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                        msg.role === 'user' 
                          ? 'bg-violet-500/20' 
                          : 'bg-emerald-500/20'
                      )}
                    >
                      {msg.role === 'user' 
                        ? <User className="w-4 h-4 text-violet-400" />
                        : <Bot className="w-4 h-4 text-emerald-400" />
                      }
                    </div>
                    <div 
                      className={cn(
                        'max-w-[80%] p-4 rounded-2xl',
                        msg.role === 'user'
                          ? 'bg-violet-500/20 text-white rounded-tr-sm'
                          : 'bg-white/[0.05] text-white/80 rounded-tl-sm'
                      )}
                    >
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))
              )}
              {isChatLoading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="p-4 rounded-2xl rounded-tl-sm bg-white/[0.05]">
                    <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          
          {/* 输入框 */}
          <div className="p-4 border-t border-white/[0.06]">
            <div className="flex gap-3">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                placeholder={sessionId ? "基于会议内容提问..." : "开始录音后可以提问"}
                disabled={!sessionId}
                className={cn(
                  'flex-1 px-4 py-3 rounded-xl text-sm',
                  'bg-white/5 border border-white/10 text-white placeholder-white/30',
                  'focus:outline-none focus:border-emerald-500/50 focus:bg-white/[0.07]',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'transition-all'
                )}
              />
              <Button
                onClick={handleSendMessage}
                disabled={!sessionId || !chatInput.trim() || isChatLoading}
                className={cn(
                  'px-4 rounded-xl',
                  'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                <Send className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
