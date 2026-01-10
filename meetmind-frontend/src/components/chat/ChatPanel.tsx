import { useState, useRef, useEffect } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ChatMessage, ScenarioType } from '@/types'
import { Send, Loader2, MessageCircle, Bot, User } from 'lucide-react'

interface ChatPanelProps {
  messages: ChatMessage[]
  onSendMessage: (message: string) => void
  isLoading?: boolean
  scenario: ScenarioType
  scenarioColor: string
}

export default function ChatPanel({
  messages,
  onSendMessage,
  isLoading,
  scenario,
  scenarioColor,
}: ChatPanelProps) {
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    onSendMessage(input.trim())
    setInput('')
  }

  const placeholderText = scenario === 'classroom'
    ? '问问关于课堂内容的问题...'
    : '问问关于会议内容的问题...'

  return (
    <div className="h-full flex flex-col">
      {/* Messages area */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 py-12">
              <MessageCircle className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">智能问答</p>
              <p className="text-sm mt-1 text-center px-4">
                {scenario === 'classroom'
                  ? '询问关于课堂内容的任何问题'
                  : '询问关于会议内容的任何问题'}
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'flex gap-3',
                  message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                )}
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                    message.role === 'user' ? 'bg-indigo-500' : 'bg-slate-700'
                  )}
                >
                  {message.role === 'user' ? (
                    <User className="w-4 h-4 text-white" />
                  ) : (
                    <Bot className="w-4 h-4 text-slate-300" />
                  )}
                </div>
                <div
                  className={cn(
                    'max-w-[80%] p-3 rounded-xl',
                    message.role === 'user'
                      ? 'bg-indigo-500 text-white'
                      : 'bg-white/5 text-slate-200'
                  )}
                >
                  {message.isLoading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">思考中...</span>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Input area */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-white/5">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholderText}
            disabled={isLoading}
            className="flex-1 h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all disabled:opacity-50"
          />
          <Button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="h-11 px-4 rounded-xl"
            style={{
              background: `linear-gradient(135deg, ${scenarioColor}, ${scenarioColor}cc)`,
            }}
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
