import { apiClient } from "./client";
import { SpeakerSegment, SummaryCard } from "@/store/useSessionStore";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  type?: "skill" | "qa" | "auto_push";
}

export const sessionApi = {
  create: () =>
    apiClient.post<{
      sessionId: string;
      taskId: string;
      meetingJoinUrl: string;
    }>("/sessions", {
      meetingId: `meeting-${Date.now()}`,
    }),
  fetchTranscripts: (sessionId: string) =>
    apiClient.get<{
      sessionId: string;
      transcription: SpeakerSegment[];
      taskStatus?: string;
    }>(`/sessions/${sessionId}/transcripts`),
  fetchSummaries: (sessionId: string) =>
    apiClient.get<{
      sessionId: string;
      summaries: SummaryCard[];
    }>(`/sessions/${sessionId}/summaries`),
  uploadAudioChunk: (sessionId: string, chunk: string) =>
    apiClient.post<{ ok: boolean }>(`/sessions/${sessionId}/audio`, {
      chunk,
    }),
  complete: (sessionId: string) =>
    apiClient.post<{ ok: boolean }>(`/sessions/${sessionId}/complete`),
  triggerSkill: (sessionId: string, skill: "inner_os" | "brainstorm" | "stop_talking") =>
    apiClient.post<{
      cards: SummaryCard[];
    }>(`/sessions/${sessionId}/skills/${skill}`),

  // 自动推送
  startAutoPush: (sessionId: string) =>
    apiClient.post<{ ok: boolean; message: string }>(
      `/sessions/${sessionId}/auto-push/start`
    ),
  stopAutoPush: (sessionId: string) =>
    apiClient.post<{ ok: boolean; message: string }>(
      `/sessions/${sessionId}/auto-push/stop`
    ),
  getAutoPushStatus: (sessionId: string) =>
    apiClient.get<{
      sessionId: string;
      running: boolean;
      lastAnalysis: string | null;
      meetingPhase: string;
    }>(`/sessions/${sessionId}/auto-push/status`),

  // 问答
  askQuestion: (sessionId: string, question: string) =>
    apiClient.post<{
      answer: string;
      messageId: string | null;
    }>(`/sessions/${sessionId}/qa`, { question }),
  getMessages: (sessionId: string) =>
    apiClient.get<{
      sessionId: string;
      messages: ChatMessage[];
    }>(`/sessions/${sessionId}/messages`),
};
