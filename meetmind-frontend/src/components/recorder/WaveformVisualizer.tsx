import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

interface WaveformVisualizerProps {
  audioLevel: number
  isRecording: boolean
  isPaused: boolean
  scenarioColor: string
  className?: string
}

export default function WaveformVisualizer({
  audioLevel,
  isRecording,
  isPaused,
  scenarioColor,
  className,
}: WaveformVisualizerProps) {
  const barsCount = 40
  const barsRef = useRef<HTMLDivElement[]>([])

  useEffect(() => {
    if (!isRecording || isPaused) return

    const updateBars = () => {
      barsRef.current.forEach((bar, index) => {
        if (!bar) return
        
        // Create wave-like pattern based on audio level
        const baseHeight = 10
        const maxAdditionalHeight = 50
        const waveOffset = Math.sin((index / barsCount) * Math.PI * 2 + Date.now() / 200) * 0.5 + 0.5
        const randomFactor = Math.random() * 0.3 + 0.7
        const height = baseHeight + audioLevel * maxAdditionalHeight * waveOffset * randomFactor
        
        bar.style.height = `${height}px`
      })
    }

    const interval = setInterval(updateBars, 50)
    return () => clearInterval(interval)
  }, [audioLevel, isRecording, isPaused])

  return (
    <div className={cn('flex items-center justify-center gap-1 h-20', className)}>
      {Array.from({ length: barsCount }).map((_, index) => (
        <div
          key={index}
          ref={(el) => {
            if (el) barsRef.current[index] = el
          }}
          className="w-1 rounded-full transition-all duration-75"
          style={{
            height: isRecording && !isPaused ? '20px' : '10px',
            backgroundColor: isRecording && !isPaused ? scenarioColor : '#475569',
            opacity: isRecording && !isPaused ? 0.8 : 0.3,
          }}
        />
      ))}
    </div>
  )
}
