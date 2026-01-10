import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { SkillConfig } from '@/types'
import { Loader2, Sparkles } from 'lucide-react'

interface SkillsBarProps {
  skills: SkillConfig[]
  onTrigger: (skillId: string) => void
  loadingSkill?: string | null
  disabled?: boolean
  scenarioColor: string
}

export default function SkillsBar({
  skills,
  onTrigger,
  loadingSkill,
  disabled,
  scenarioColor,
}: SkillsBarProps) {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 text-white/50">
        <Sparkles className="w-4 h-4" />
        <span className="text-sm font-medium">AI 技能</span>
      </div>

      {/* Skills grid */}
      <div className="grid grid-cols-2 gap-2">
        {skills.map((skill) => {
          const isLoading = loadingSkill === skill.id
          return (
            <Tooltip key={skill.id}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  onClick={() => onTrigger(skill.id)}
                  disabled={disabled || !!loadingSkill}
                  className={cn(
                    'h-auto py-3 px-4 rounded-xl justify-start',
                    'bg-white/5 hover:bg-white/10 border border-white/5',
                    'transition-all duration-300',
                    'disabled:opacity-40 disabled:cursor-not-allowed',
                    isLoading && 'border-violet-500/50 bg-violet-500/10'
                  )}
                >
                  <div className="flex items-center gap-3 w-full">
                    {isLoading ? (
                      <div 
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: `${scenarioColor}20` }}
                      >
                        <Loader2 
                          className="w-4 h-4 animate-spin" 
                          style={{ color: scenarioColor }} 
                        />
                      </div>
                    ) : (
                      <div 
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
                        style={{ background: `${scenarioColor}15` }}
                      >
                        {skill.icon}
                      </div>
                    )}
                    <div className="text-left flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {skill.name}
                      </p>
                      <p className="text-xs text-white/40 truncate">
                        {isLoading ? '分析中...' : '点击触发'}
                      </p>
                    </div>
                  </div>
                </Button>
              </TooltipTrigger>
              <TooltipContent 
                side="top" 
                className="glass-card border-white/10 max-w-xs"
              >
                <p className="text-sm">{skill.description}</p>
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>

      {/* Disabled hint */}
      {disabled && (
        <p className="text-xs text-white/30 text-center">
          开始录音后可使用 AI 技能
        </p>
      )}
    </div>
  )
}
