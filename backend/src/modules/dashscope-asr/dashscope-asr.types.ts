/**
 * DashScope ASR 类型定义
 * 百炼实时语音识别服务 (qwen3-asr-flash-realtime)
 */

/**
 * ASR 句子结果
 */
export interface ASRSentence {
  id: string;
  text: string;
  beginTime: number;  // 毫秒
  endTime: number;    // 毫秒
  isFinal: boolean;
  confidence?: number;
}

/**
 * DashScope ASR 配置
 */
export interface DashScopeASRConfig {
  apiKey: string;
  model: string;
  wsEndpoint: string;
  sampleRate: number;
  language: string;
}

/**
 * DashScope WebSocket 消息类型
 */
export type DashScopeEventType =
  | 'session.created'
  | 'session.updated'
  | 'input_audio_buffer.speech_started'
  | 'input_audio_buffer.speech_stopped'
  | 'conversation.item.input_audio_transcription.completed'
  | 'conversation.item.input_audio_transcription.text'
  | 'conversation.item.input_audio_transcription.delta'
  | 'error'
  | 'response.done';

/**
 * DashScope 会话配置
 */
export interface DashScopeSessionConfig {
  event_id: string;
  type: 'session.update';
  session: {
    input_audio_format: 'pcm';
    sample_rate: number;
    input_audio_transcription: {
      language: string;
    };
    turn_detection: {
      type: 'server_vad';
      threshold: number;
      silence_duration_ms: number;
    };
  };
}

/**
 * DashScope 音频数据事件
 */
export interface DashScopeAudioAppendEvent {
  event_id: string;
  type: 'input_audio_buffer.append';
  audio: string;  // Base64 编码的 PCM 数据
}

/**
 * DashScope 提交缓冲区事件
 */
export interface DashScopeCommitEvent {
  event_id: string;
  type: 'input_audio_buffer.commit';
}

/**
 * DashScope 转录完成消息
 */
export interface DashScopeTranscriptionCompletedMessage {
  type: 'conversation.item.input_audio_transcription.completed';
  item?: {
    content?: Array<{ text?: string }>;
  };
  transcript?: string;
  text?: string;
  begin_time?: number;
  end_time?: number;
  audio_start_ms?: number;
  audio_end_ms?: number;
}

/**
 * DashScope 中间结果消息
 */
export interface DashScopeInterimMessage {
  type: 'conversation.item.input_audio_transcription.text' | 'conversation.item.input_audio_transcription.delta';
  text?: string;
  delta?: string;
}

/**
 * DashScope 错误消息
 */
export interface DashScopeErrorMessage {
  type: 'error';
  error?: {
    message?: string;
  };
  message?: string;
}

/**
 * 音频中继会话状态
 */
export interface AudioRelaySession {
  sessionId: string;
  socket: WebSocket | null;
  isConnected: boolean;
  isSessionReady: boolean;
  isStopping: boolean;
  isFailed: boolean;
  ffmpegProcess: any | null;  // ChildProcess
  audioQueue: Buffer[];
  lastDataTime: number;
  reconnectAttempts: number;
  sentenceIndex: number;
  sessionStartTime: number;
  lastSentenceEndTime: number;
}

/**
 * 转录结果回调
 */
export interface TranscriptionCallbacks {
  onSentence?: (sessionId: string, sentence: ASRSentence) => void;
  onInterim?: (sessionId: string, text: string) => void;
  onError?: (sessionId: string, error: string) => void;
  onStatusChange?: (sessionId: string, status: string) => void;
}
