import { useEffect, useRef, useState } from "react";
import { Audio } from "expo-av";
import {
  AndroidAudioEncoder,
  AndroidOutputFormat,
  IOSAudioQuality,
  IOSOutputFormat,
} from "expo-av/build/Audio/RecordingConstants";
import * as FileSystem from "expo-file-system";
import type { RecordingOptions } from "expo-av/build/Audio/Recording.types";

type RecorderStatus = "idle" | "recording" | "paused" | "stopped";

const decodeBase64ToBytes = (input: string) => {
  if (typeof globalThis.atob === "function") {
    const binary = globalThis.atob(input);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }

  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  const clean = input.replace(/[^A-Za-z0-9+/=]/g, "");
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let byteIndex = 0;

  for (let i = 0; i < clean.length; i += 4) {
    const enc1 = chars.indexOf(clean[i]);
    const enc2 = chars.indexOf(clean[i + 1]);
    const enc3 = chars.indexOf(clean[i + 2]);
    const enc4 = chars.indexOf(clean[i + 3]);

    const chr1 = (enc1 << 2) | (enc2 >> 4);
    const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    const chr3 = ((enc3 & 3) << 6) | enc4;

    bytes[byteIndex++] = chr1;

    if (enc3 !== 64 && clean[i + 2] !== "=") {
      bytes[byteIndex++] = chr2;
    }
    if (enc4 !== 64 && clean[i + 3] !== "=") {
      bytes[byteIndex++] = chr3;
    }
  }

  return bytes.slice(0, byteIndex);
};

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const slice = bytes.subarray(index, index + chunkSize);
    let chunkString = "";
    for (let i = 0; i < slice.length; i += 1) {
      chunkString += String.fromCharCode(slice[i]);
    }
    binary += chunkString;
  }
  return globalThis.btoa(binary);
};

type RecorderChunk = {
  bytes: ArrayBuffer;
  base64: string;
};

type ChunkHandlerResult = void | boolean | Promise<void | boolean>;

export const useRecorder = (onChunk: (chunk: RecorderChunk) => ChunkHandlerResult) => {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [level, setLevel] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const tickRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const accumulatedMsRef = useRef(0);
  const lastByteIndexRef = useRef(0);
  const uploadingRef = useRef(false);

  const clearTick = () => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  };

  const start = async () => {
    if (status === "recording") return;

    if (status === "paused" && recordingRef.current) {
      await recordingRef.current.startAsync();
      startTimeRef.current = Date.now();
      setStatus("recording");
      startTick();
      return;
    }

    const { granted } = await Audio.requestPermissionsAsync();
    if (!granted) throw new Error("Microphone permission denied");

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
    } catch (audioModeError) {
      console.warn("Failed to set audio mode:", audioModeError);
    }

    const recordingOptions: RecordingOptions = {
      isMeteringEnabled: true,
      android: {
        extension: ".m4a",
        outputFormat: AndroidOutputFormat.MPEG_4,
        audioEncoder: AndroidAudioEncoder.AAC,
        sampleRate: 16000,
        numberOfChannels: 1,
        bitRate: 64000,
      },
      ios: {
        extension: ".m4a",
        outputFormat: IOSOutputFormat.MPEG4AAC,
        audioQuality: IOSAudioQuality.MEDIUM,
        sampleRate: 16000,
        numberOfChannels: 1,
        bitRate: 64000,
        linearPCMBitDepth: 16,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
      },
      web: {
        mimeType: "audio/webm",
        bitsPerSecond: 64000,
      },
    };

    const recording = new Audio.Recording();
    try {
      await recording.prepareToRecordAsync(recordingOptions);
    } catch (prepareError) {
      console.error("Failed to prepare recording:", prepareError);
      throw new Error(`录音准备失败: ${prepareError instanceof Error ? prepareError.message : String(prepareError)}`);
    }
    
    try {
      await recording.startAsync();
    } catch (startError) {
      console.error("Failed to start recording:", startError);
      // 清理已准备的录音对象
      try {
        await recording.stopAndUnloadAsync();
      } catch {}
      throw new Error(`录音启动失败（模拟器可能不支持麦克风，请使用真机测试）: ${startError instanceof Error ? startError.message : String(startError)}`);
    }
    recordingRef.current = recording;
    lastByteIndexRef.current = 0;
    startTimeRef.current = Date.now();
    accumulatedMsRef.current = 0;
    setElapsedMs(0);
    setStatus("recording");

    startTick();
  };

  const pause = async () => {
    if (status !== "recording" || !recordingRef.current) return;

    await recordingRef.current.pauseAsync();
    if (startTimeRef.current) {
      accumulatedMsRef.current += Date.now() - startTimeRef.current;
    }
    startTimeRef.current = null;
    clearTick();
    setElapsedMs(accumulatedMsRef.current);
    setLevel(0);
    setStatus("paused");
  };

  const resume = async () => {
    if (status !== "paused" || !recordingRef.current) return;

    await recordingRef.current.startAsync();
    startTimeRef.current = Date.now();
    setStatus("recording");
    startTick();
  };

  const startTick = () => {
    clearTick();
    tickRef.current = setInterval(async () => {
      if (!recordingRef.current) return;
      try {
        const uri = recordingRef.current.getURI();
        if (!uri) return;
        const file = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const bytes = decodeBase64ToBytes(file);
        const previousIndex = lastByteIndexRef.current;
        const nextIndex = bytes.byteLength;
        if (nextIndex > previousIndex && !uploadingRef.current) {
          const chunk = bytes.slice(previousIndex, nextIndex);
          if (chunk.byteLength > 0) {
            const base64Chunk = bytesToBase64(chunk);
            uploadingRef.current = true;
            try {
              const result = await onChunk({
                bytes: chunk.buffer,
                base64: base64Chunk,
              });
              if (result !== false) {
                lastByteIndexRef.current = nextIndex;
              }
            } catch (error) {
              console.warn("Failed to forward audio chunk", error);
            } finally {
              uploadingRef.current = false;
            }
          }
        }
        if (startTimeRef.current) {
          try {
            const status = await recordingRef.current.getStatusAsync();
            if (typeof status.metering === "number") {
              const normalized = Math.min(
                1,
                Math.max(0, (status.metering + 60) / 60)
              );
              setLevel(normalized);
            }
          } catch (error) {
            // swallow metering errors
          }
          setElapsedMs(
            accumulatedMsRef.current + (Date.now() - startTimeRef.current)
          );
        }
      } catch (error) {
        console.warn("Failed to read audio chunk", error);
      }
    }, 1000);
  };

  const stop = async () => {
    if (!recordingRef.current) return;

    clearTick();
    if (startTimeRef.current) {
      accumulatedMsRef.current += Date.now() - startTimeRef.current;
    }
    await recordingRef.current.stopAndUnloadAsync();
    recordingRef.current = null;
    startTimeRef.current = null;
    setElapsedMs(accumulatedMsRef.current);
    accumulatedMsRef.current = 0;
    lastByteIndexRef.current = 0;
    setLevel(0);
    setStatus("stopped");
  };

  useEffect(() => {
    return () => {
      clearTick();
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => null);
        recordingRef.current = null;
      }
      startTimeRef.current = null;
      accumulatedMsRef.current = 0;
      lastByteIndexRef.current = 0;
      uploadingRef.current = false;
      setElapsedMs(0);
      setLevel(0);
    };
  }, []);

  return {
    status,
    elapsedMs,
    level,
    start,
    pause,
    resume,
    stop,
  };
};
