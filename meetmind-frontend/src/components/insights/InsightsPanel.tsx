import { useRef, useEffect } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import InsightCard from './InsightCard'
import type { Insight, ScenarioType } from '@/types'
import { Sparkles } from 'lucide-react'

interface InsightsPanelProps {
  insights: Insight[]
  scenario: ScenarioType
}

export default function InsightsPanel({ insights, scenario }: InsightsPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [insights])

  if (insights.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-500">
        <Sparkles className="w-12 h-12 mb-4 opacity-50" />
        <p className="text-lg font-medium">等待 AI 洞察</p>
        <p className="text-sm mt-1 text-center px-4">
          AI 将自动分析对话内容，<br />生成有价值的洞察
        </p>
      </div>
    )
  }

  return (
    <ScrollArea className="h-full" ref={scrollRef}>
      <div className="p-4 space-y-3">
        {insights.map((insight) => (
          <InsightCard key={insight.id} insight={insight} scenario={scenario} />
        ))}
      </div>
    </ScrollArea>
  )
}
