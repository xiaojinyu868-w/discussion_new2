import { cn } from '@/lib/utils'
import { Mic, Pause, Square, Play } from 'lucide-react'

interface RecordButtonProps {
  isRecording: boolean
  isPaused: boolean
  audioLevel: number
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
  scenarioColor: string
}

export default function RecordButton({
  isRecording,
  isPaused,
  audioLevel,
  onStart,
  onPause,
  onResume,
  onStop,
  scenarioColor,
}: RecordButtonProps) {
  const handleMainClick = () => {
    if (!isRecording) {
      onStart()
    } else if (isPaused) {
      onResume()
    } else {
      onPause()
    }
  }

  // Generate wave bars for visualization
  const waveBars = Array.from({ length: 12 }, (_, i) => {
    const delay = i * 0.08
    const baseHeight = 20 + Math.sin(i * 0.5) * 10
    const dynamicHeight = isRecording && !isPaused 
      ? baseHeight + audioLevel * 60 
      : baseHeight
    return { delay, height: dynamicHeight }
  })

  return (
    <div className="flex flex-col items-center gap-8">
      {/* Sound wave visualization */}
      <div className="flex items-end justify-center gap-1 h-20 mb-4">
        {waveBars.map((bar, i) => (
          <div
            key={i}
            className={cn(
              'w-1.5 rounded-full transition-all duration-150',
              isRecording && !isPaused
                ? 'bg-gradient-to-t from-violet-500 to-cyan-400'
                : 'bg-white/20'
            )}
            style={{
              height: `${bar.height}px`,
              animationDelay: `${bar.delay}s`,
              transform: isRecording && !isPaused ? `scaleY(${0.5 + audioLevel})` : 'scaleY(0.5)',
              transformOrigin: 'bottom',
            }}
          />
        ))}
      </div>

      {/* Main record button */}
      <div className="relative">
        {/* Outer glow rings */}
        {isRecording && !isPaused && (
          <>
            <div 
              className="absolute inset-0 rounded-full animate-ripple"
              style={{ 
                background: `radial-gradient(circle, ${scenarioColor}40 0%, transparent 70%)`,
              }}
            />
            <div 
              className="absolute -inset-4 rounded-full animate-ripple"
              style={{ 
                background: `radial-gradient(circle, ${scenarioColor}20 0%, transparent 70%)`,
                animationDelay: '0.5s',
              }}
            />
            <div 
              className="absolute -inset-8 rounded-full animate-ripple"
              style={{ 
                background: `radial-gradient(circle, ${scenarioColor}10 0%, transparent 70%)`,
                animationDelay: '1s',
              }}
            />
          </>
        )}

        {/* Audio level ring */}
        {isRecording && !isPaused && (
          <div
            className="absolute inset-0 rounded-full transition-transform duration-75"
            style={{
              background: `radial-gradient(circle, ${scenarioColor}30 0%, transparent 60%)`,
              transform: `scale(${1.2 + audioLevel * 0.5})`,
            }}
          />
        )}

        {/* Gradient border ring */}
        <div 
          className={cn(
            'absolute -inset-1 rounded-full transition-opacity duration-300',
            isRecording ? 'opacity-100' : 'opacity-0'
          )}
          style={{
            background: `conic-gradient(from 0deg, ${scenarioColor}, #8b5cf6, #06b6d4, ${scenarioColor})`,
            animation: isRecording && !isPaused ? 'rotate-slow 3s linear infinite' : 'none',
          }}
        />
        <div className="absolute inset-0 rounded-full bg-[#0f0c29]" />

        {/* Main button */}
        <button
          onClick={handleMainClick}
          className={cn(
            'relative w-36 h-36 rounded-full flex items-center justify-center transition-all duration-300',
            'hover:scale-105 active:scale-95',
            isRecording && !isPaused ? 'animate-pulse-glow' : ''
          )}
          style={{
            background: isRecording
              ? `linear-gradient(135deg, ${scenarioColor}, ${scenarioColor}cc)`
              : 'linear-gradient(135deg, #8b5cf6, #6366f1)',
          }}
        >
          {/* Inner highlight */}
          <div className="absolute inset-2 rounded-full bg-gradient-to-b from-white/20 to-transparent" />
          
          {/* Icon */}
          <div className="relative z-10">
            {!isRecording ? (
              <Mic className="w-14 h-14 text-white drop-shadow-lg" />
            ) : isPaused ? (
              <Play className="w-14 h-14 text-white drop-shadow-lg ml-1" />
            ) : (
              <Pause className="w-14 h-14 text-white drop-shadow-lg" />
            )}
          </div>
        </button>
      </div>

      {/* Status text */}
      <div className="text-center">
        <p className="text-lg font-medium text-white/90 mb-1">
          {!isRecording
            ? '点击开始录音'
            : isPaused
            ? '已暂停'
            : '正在录音'}
        </p>
        <p className="text-sm text-white/50">
          {!isRecording
            ? '准备好后点击麦克风按钮'
            : isPaused
            ? '点击继续录音'
            : '点击暂停录音'}
        </p>
      </div>

      {/* Stop button */}
      {isRecording && (
        <button
          onClick={onStop}
          className={cn(
            'flex items-center gap-3 px-8 py-4 rounded-2xl transition-all duration-300',
            'bg-red-500/10 border border-red-500/20',
            'text-red-400 hover:text-red-300',
            'hover:bg-red-500/20 hover:border-red-500/30',
            'hover-lift animate-scale-in'
          )}
        >
          <Square className="w-5 h-5" />
          <span className="font-semibold">结束录音</span>
        </button>
      )}
    </div>
  )
}
