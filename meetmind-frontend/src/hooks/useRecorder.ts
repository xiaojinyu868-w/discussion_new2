import { useState, useRef, useCallback, useEffect } from 'react'
import api from '@/services/api'

interface UseRecorderOptions {
  sessionId?: string | null
  onTranscription?: (segments: Array<{ id: string; text: string; speakerId?: string }>) => void
}

interface UseRecorderReturn {
  isRecording: boolean
  isPaused: boolean
  duration: number
  audioLevel: number
  audioBlob: Blob | null
  startRecording: (newSessionId?: string) => Promise<void>
  stopRecording: () => Promise<Blob | null>
  pauseRecording: () => void
  resumeRecording: () => void
  resetRecording: () => void
}

export function useRecorder(options: UseRecorderOptions = {}): UseRecorderReturn {
  const { sessionId, onTranscription } = options
  
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [duration, setDuration] = useState(0)
  const [audioLevel, setAudioLevel] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<number | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const pollIntervalRef = useRef<number | null>(null)
  const lastTranscriptCountRef = useRef<number>(0)

  // Keep sessionId ref updated
  useEffect(() => {
    sessionIdRef.current = sessionId ?? null
    // Reset transcript count when session changes
    if (sessionId) {
      lastTranscriptCountRef.current = 0
    }
  }, [sessionId])

  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current) return

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
    analyserRef.current.getByteFrequencyData(dataArray)
    
    const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
    setAudioLevel(average / 255)

    if (isRecording && !isPaused) {
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel)
    }
  }, [isRecording, isPaused])

  // Send audio chunk to backend
  const sendAudioChunk = useCallback(async (blob: Blob) => {
    if (!sessionIdRef.current) {
      console.log('[Recorder] No session ID, skipping audio chunk')
      return
    }

    try {
      // Convert blob to base64
      const arrayBuffer = await blob.arrayBuffer()
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      )
      
      if (base64) {
        console.log(`[Recorder] Sending audio chunk: ${base64.length} bytes to session ${sessionIdRef.current}`)
        await api.post(`/sessions/${sessionIdRef.current}/audio`, {
          chunk: base64
        })
      }
    } catch (error) {
      console.error('[Recorder] Failed to send audio chunk:', error)
    }
  }, [])

  // Poll for transcriptions
  const pollTranscriptions = useCallback(async () => {
    if (!sessionIdRef.current || !onTranscription) return

    try {
      const response = await api.get(`/sessions/${sessionIdRef.current}/transcripts`)
      const data = response.data as { transcription?: Array<{ id: string; text: string; speakerId?: string }> }
      
      if (data.transcription && data.transcription.length > lastTranscriptCountRef.current) {
        // Only send new segments
        const newSegments = data.transcription.slice(lastTranscriptCountRef.current)
        lastTranscriptCountRef.current = data.transcription.length
        
        console.log(`[Recorder] Got ${newSegments.length} new transcription segments`)
        onTranscription(newSegments)
      }
    } catch (error) {
      // Silently ignore polling errors
      console.error('[Recorder] Polling error:', error)
    }
  }, [onTranscription])

  const startRecording = useCallback(async (newSessionId?: string) => {
    // If a new sessionId is provided, update the ref immediately
    if (newSessionId) {
      sessionIdRef.current = newSessionId
      lastTranscriptCountRef.current = 0
      console.log(`[Recorder] Session ID set to: ${newSessionId}`)
    }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        } 
      })
      streamRef.current = stream

      // Setup audio analysis
      audioContextRef.current = new AudioContext({ sampleRate: 16000 })
      analyserRef.current = audioContextRef.current.createAnalyser()
      const source = audioContextRef.current.createMediaStreamSource(stream)
      source.connect(analyserRef.current)
      analyserRef.current.fftSize = 256

      // Setup MediaRecorder - use webm/opus for better compatibility
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : 'audio/webm'
      
      console.log(`[Recorder] Using mimeType: ${mimeType}`)
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
          // Send chunk to backend for real-time transcription
          sendAudioChunk(event.data)
        }
      }

      // Collect data every 500ms for more responsive transcription
      mediaRecorder.start(500)
      setIsRecording(true)
      setIsPaused(false)
      setDuration(0)
      setAudioBlob(null)
      lastTranscriptCountRef.current = 0

      // Start duration timer
      timerRef.current = window.setInterval(() => {
        setDuration(prev => prev + 1)
      }, 1000)

      // Start audio level monitoring
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel)

      // Start polling for transcriptions (every 1.5 seconds)
      if (onTranscription) {
        pollIntervalRef.current = window.setInterval(pollTranscriptions, 1500)
      }
      
      console.log('[Recorder] Recording started')
    } catch (error) {
      console.error('[Recorder] Failed to start recording:', error)
      throw error
    }
  }, [updateAudioLevel, sendAudioChunk, pollTranscriptions, onTranscription])

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    console.log('[Recorder] Stopping recording...')
    
    // Stop polling
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }

    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
        resolve(null)
        return
      }

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        console.log(`[Recorder] Recording stopped, total size: ${blob.size} bytes`)
        resolve(blob)
      }

      mediaRecorderRef.current.stop()
      
      // Cleanup
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
        audioContextRef.current = null
      }

      setIsRecording(false)
      setIsPaused(false)
      setAudioLevel(0)
    })
  }, [])

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause()
      setIsPaused(true)
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
      console.log('[Recorder] Recording paused')
    }
  }, [])

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume()
      setIsPaused(false)
      timerRef.current = window.setInterval(() => {
        setDuration(prev => prev + 1)
      }, 1000)
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel)
      if (onTranscription) {
        pollIntervalRef.current = window.setInterval(pollTranscriptions, 1500)
      }
      console.log('[Recorder] Recording resumed')
    }
  }, [updateAudioLevel, pollTranscriptions, onTranscription])

  const resetRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
    }

    mediaRecorderRef.current = null
    audioContextRef.current = null
    analyserRef.current = null
    streamRef.current = null
    chunksRef.current = []
    timerRef.current = null
    animationFrameRef.current = null
    pollIntervalRef.current = null
    lastTranscriptCountRef.current = 0

    setIsRecording(false)
    setIsPaused(false)
    setDuration(0)
    setAudioLevel(0)
    setAudioBlob(null)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      resetRecording()
    }
  }, [resetRecording])

  return {
    isRecording,
    isPaused,
    duration,
    audioLevel,
    audioBlob,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetRecording,
  }
}
