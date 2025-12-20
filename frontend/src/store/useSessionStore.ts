import { create } from "zustand";
import { devtools } from "zustand/middleware";

export type SpeakerSegment = {
  id: string;
  speakerId: string;
  startMs: number;
  endMs: number;
  text: string;
};

export type SummaryCard = {
  id: string;
  type:
    | "paragraph"
    | "conversational"
    | "keywords"
    | "todo"
    | "qa"
    | "chapter"
    | "inner_os"
    | "brainstorm"
    | "stop_talking"
    | "auto_analysis";
  title?: string;
  content: string | string[] | Record<string, unknown>;
  updatedAt: string;
};

type SkillState = "idle" | "loading" | "success" | "error";
type SkillName = "inner_os" | "brainstorm" | "stop_talking";

type SessionState = {
  sessionId?: string;
  taskId?: string;
  meetingJoinUrl?: string;
  isRecording: boolean;
  transcription: SpeakerSegment[];
  summaryCards: SummaryCard[];
  taskStatus?: string;
  skillState: Record<SkillName, SkillState>;
  setTask: (sessionId: string, taskId: string, meetingJoinUrl: string) => void;
  toggleRecording: (value: boolean) => void;
  appendTranscription: (segments: SpeakerSegment[]) => void;
  upsertSummaryCards: (cards: SummaryCard[]) => void;
  setSkillState: (skill: SkillName, state: SkillState) => void;
  setTaskStatus: (status?: string) => void;
  reset: () => void;
};

export const useSessionStore = create<SessionState>()(
  devtools((set) => ({
    sessionId: undefined,
    taskId: undefined,
    meetingJoinUrl: undefined,
    isRecording: false,
    transcription: [],
    summaryCards: [],
    taskStatus: undefined,
    skillState: {
      inner_os: "idle",
      brainstorm: "idle",
      stop_talking: "idle",
    },
    setTask: (sessionId, taskId, meetingJoinUrl) =>
      set({
        sessionId,
        taskId,
        meetingJoinUrl,
        taskStatus: "NEW",
      }),
    toggleRecording: (value) =>
      set({
        isRecording: value,
      }),
    appendTranscription: (segments) =>
      set((state) => {
        const merged = [...state.transcription];
        segments.forEach((segment) => {
          const index = merged.findIndex((item) => item.id === segment.id);
          if (index >= 0) {
            merged[index] = segment;
          } else {
            merged.push(segment);
          }
        });
        merged.sort((a, b) => a.startMs - b.startMs);
        return { transcription: merged };
      }),
    upsertSummaryCards: (cards) =>
      set((state) => {
        const map = new Map<string, SummaryCard>();
        [...state.summaryCards, ...cards].forEach((card) => {
          map.set(card.id, card);
        });
        const sorted = Array.from(map.values()).sort((a, b) =>
          a.updatedAt.localeCompare(b.updatedAt)
        );
        return { summaryCards: sorted };
      }),
    setTaskStatus: (status) =>
      set({
        taskStatus: status,
      }),
    setSkillState: (skill, value) =>
      set((state) => ({
        skillState: {
          ...state.skillState,
          [skill]: value,
        },
      })),
    reset: () =>
      set({
        sessionId: undefined,
        taskId: undefined,
        meetingJoinUrl: undefined,
        isRecording: false,
        transcription: [],
        summaryCards: [],
        taskStatus: undefined,
        skillState: {
          inner_os: "idle",
          brainstorm: "idle",
          stop_talking: "idle",
        },
      }),
  }))
);

export const registerRootStoreCleanup = () => {
  const { reset } = useSessionStore.getState();
  return reset;
};
