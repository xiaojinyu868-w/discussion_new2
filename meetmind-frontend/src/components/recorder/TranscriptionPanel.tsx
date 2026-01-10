import { useRef, useEffect } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { TranscriptionSegment } from '@/types'
import { FileText, Loader2 } from 'lucide-react'

interface TranscriptionPanelProps {
  segments: TranscriptionSegment[]
  isLoading?: boolean
  scenarioColor: string
}

export default function TranscriptionPanel({
  segments,
  isLoading,
  scenarioColor,
}: TranscriptionPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [segments])

  if (segments.length === 0 && !isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-500">
        <FileText className="w-12 h-12 mb-4 opacity-50" />
        <p className="text-lg font-medium">等待转写内容</p>
        <p className="text-sm mt-1">开始录音后，转写结果将在这里显示</p>
      </div>
    )
  }

  return (
    <ScrollArea className="h-full" ref={scrollRef}>
      <div className="p-4 space-y-3">
        {segments.map((segment, index) => (
          <div
            key={segment.id}
            className={cn(
              'p-4 rounded-xl bg-white/5 border border-white/5 transition-all duration-300',
              index === segments.length - 1 && 'border-l-2'
            )}
            style={{
              borderLeftColor: index === segments.length - 1 ? scenarioColor : 'transparent',
            }}
          >
            {segment.speaker && (
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium text-white"
                  style={{ backgroundColor: scenarioColor }}
                >
                  {segment.speaker.charAt(0)}
                </div>
                <span className="text-sm font-medium text-slate-300">{segment.speaker}</span>
                <span className="text-xs text-slate-500">
                  {Math.floor(segment.startTime / 60)}:{String(Math.floor(segment.startTime % 60)).padStart(2, '0')}
                </span>
              </div>
            )}
            <p className="text-slate-200 leading-relaxed">{segment.text}</p>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex items-center gap-2 p-4 text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">正在转写...</span>
          </div>
        )}
      </div>
    </ScrollArea>
  )
}
