import { useCallback, useEffect, useRef } from "react";
import { sessionApi } from "@/api/session";
import { useSessionStore } from "@/store/useSessionStore";

export const useAudioUploader = () => {
  const sessionId = useSessionStore((state) => state.sessionId);
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  const uploadChunk = useCallback(
    (base64Chunk: string) => {
      if (!sessionId) {
        return Promise.resolve();
      }
      const send = () => sessionApi.uploadAudioChunk(sessionId, base64Chunk);
      const task = queueRef.current.then(send, send);
      queueRef.current = task.catch(() => void 0);
      return task.catch((error) => {
        console.warn("Failed to upload audio chunk", error);
        throw error;
      });
    },
    [sessionId]
  );

  useEffect(() => {
    queueRef.current = Promise.resolve();
  }, [sessionId]);

  return {
    uploadChunk,
  };
};
