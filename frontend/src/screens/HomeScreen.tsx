import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Animated,
  Platform,
  TextInput,
  Switch,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSessionStore } from "@/store/useSessionStore";
import { colors, gradients } from "@/theme/colors";
import { typography } from "@/theme/typography";
import { useRecorder } from "@/hooks/useRecorder";
import { useAudioUploader } from "@/hooks/useAudioUploader";
import TranscriptionList from "@/components/TranscriptionList";
import SummaryList from "@/components/SummaryList";
import { sessionApi, ChatMessage } from "@/api/session";

const formatDuration = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
};

const HomeScreen = () => {
  const {
    sessionId,
    transcription,
    summaryCards,
    isRecording,
    toggleRecording,
    setTask,
    taskId,
    skillState,
    taskStatus,
  } = useSessionStore();

  const { uploadChunk } = useAudioUploader();
  const recorder = useRecorder(async (chunk) => {
    if (!sessionId) {
      noteError("上传音频失败", "Session 未初始化");
      return false;
    }
    try {
      await uploadChunk(chunk.base64);
      return true;
    } catch (error) {
      console.warn("Failed to upload chunk", error);
      noteError("上传音频分片失败", error);
      return false;
    }
  });

  const waveformAnim = useRef(new Animated.Value(0)).current;
  const [activeTab, setActiveTab] = useState<"transcription" | "summary">(
    "transcription"
  );
  const [isRefreshing, setRefreshing] = useState(false);
  const [llmOutput, setLlmOutput] = useState("");
  const [llmError, setLlmError] = useState("");
  const [autoPushEnabled, setAutoPushEnabled] = useState(false);
  const [qaQuestion, setQaQuestion] = useState("");
  const [qaLoading, setQaLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  const stringify = (value: unknown) => {
    if (value instanceof Error) {
      return value.message;
    }
    if (typeof value === "string") {
      return value;
    }
    if (value === undefined) {
      return "undefined";
    }
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  };

  const noteResult = (label: string, payload: unknown) => {
    setLlmOutput(`${label}\n${stringify(payload)}`);
    setLlmError("");
  };

  const noteError = (label: string, error: unknown) => {
    setLlmError(`${label}\n${stringify(error)}`);
  };

  useEffect(() => {
    if (taskId) return;
    const bootstrap = async () => {
      try {
        const response = await sessionApi.create();
        setTask(response.sessionId, response.taskId, response.meetingJoinUrl);
        noteResult("任务创建成功", response);
      } catch (error) {
        console.error("Failed to create session", error);
        noteError("创建任务失败", error);
      }
    };
    bootstrap();
  }, [setTask, taskId]);

  useEffect(() => {
    if (!sessionId) return;
    let active = true;
    let polling = false;

    const poll = async () => {
      if (!active || polling) return;
      polling = true;
      try {
        const transcripts = await sessionApi.fetchTranscripts(sessionId);
        useSessionStore.getState().appendTranscription(
          transcripts.transcription
        );
        useSessionStore.getState().setTaskStatus(transcripts.taskStatus);
        const summaries = await sessionApi.fetchSummaries(sessionId);
        useSessionStore.getState().upsertSummaryCards(summaries.summaries);
        noteResult("轮询结果", {
          taskStatus: transcripts.taskStatus,
          transcription: transcripts.transcription.slice(-2),
          summaries: summaries.summaries.slice(-2),
        });
      } catch (error) {
        console.warn("Failed to poll session updates", error);
        noteError("轮询失败", error);
      } finally {
        polling = false;
      }
    };

    poll();
    const interval = setInterval(poll, 4000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [sessionId]);

  useEffect(() => {
    Animated.spring(waveformAnim, {
      toValue: recorder.level,
      useNativeDriver: true,
      damping: 12,
      stiffness: 120,
      mass: 0.7,
    }).start();
  }, [recorder.level, waveformAnim]);

  const remoteStatusHint = useMemo(() => {
    switch (taskStatus) {
      case "NEW":
        return "已连接听悟，正在等待音频…";
      case "PAUSED":
        return "听悟任务已暂停";
      case "FAILED":
        return "听悟任务失败，请检查网络";
      case "COMPLETED":
        return "听悟任务已完成";
      default:
        return undefined;
    }
  }, [taskStatus]);

  const statusMeta = useMemo(() => {
    if (recorder.status === "recording") {
      return { label: "录制进行中", tone: colors.success };
    }
    if (recorder.status === "paused") {
      return { label: "录制已暂停", tone: colors.warning };
    }
    if (taskStatus === "FAILED") {
      return { label: "连接异常", tone: "#F87171" };
    }
    if (taskStatus === "COMPLETED") {
      return { label: "任务已结束", tone: colors.textMuted };
    }
    if (taskStatus === "ONGOING") {
      return { label: "同步中", tone: colors.success };
    }
    return { label: "等待开始", tone: colors.textMuted };
  }, [taskStatus, recorder.status]);

  const recordingHint = useMemo(() => {
    if (remoteStatusHint && taskStatus !== "ONGOING") {
      return remoteStatusHint;
    }
    if (recorder.status === "recording") {
      return recorder.level < 0.1
        ? "未检测到声音，请靠近麦克风"
        : "正在捕获声音…";
    }
    if (recorder.status === "paused") {
      return "录音已暂停";
    }
    if (recorder.status === "stopped") {
      return "录音已停止";
    }
    return "准备录音";
  }, [remoteStatusHint, taskStatus, recorder.status, recorder.level]);

  const handleRecordToggle = async () => {
    if (recorder.status === "recording" || recorder.status === "paused") {
      await recorder.stop();
      toggleRecording(false);
      if (sessionId) {
        try {
          await sessionApi.complete(sessionId);
          noteResult("已请求停止任务", { sessionId });
        } catch (error) {
          console.warn("Failed to complete session", error);
          noteError("停止任务失败", error);
        }
      }
      return;
    }
    if (!sessionId) {
      try {
        const response = await sessionApi.create();
        setTask(response.sessionId, response.taskId, response.meetingJoinUrl);
        noteResult("任务创建成功", response);
      } catch (error) {
        console.error("Failed to initialize session before recording", error);
        noteError("初始化任务失败", error);
        return;
      }
    }
    try {
      await recorder.start();
      toggleRecording(true);
    } catch (error) {
      console.error("Failed to start recording", error);
      noteError("启动录音失败", error);
    }
  };

  const handlePauseResume = async () => {
    if (recorder.status === "recording") {
      await recorder.pause();
      toggleRecording(false);
    } else if (recorder.status === "paused") {
      await recorder.resume();
      toggleRecording(true);
    }
  };

  const isPauseResumeDisabled =
    recorder.status === "idle" || recorder.status === "stopped";

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      if (!sessionId) return;
      const [transcripts, summaries] = await Promise.all([
        sessionApi.fetchTranscripts(sessionId),
        sessionApi.fetchSummaries(sessionId),
      ]);
      useSessionStore.getState().appendTranscription(
        transcripts.transcription
      );
      useSessionStore.getState().setTaskStatus(transcripts.taskStatus);
      useSessionStore.getState().upsertSummaryCards(summaries.summaries);
      noteResult("手动刷新结果", {
        taskStatus: transcripts.taskStatus,
        transcription: transcripts.transcription.slice(-2),
        summaries: summaries.summaries.slice(-2),
      });
    } catch (error) {
      noteError("手动刷新失败", error);
    } finally {
      setRefreshing(false);
    }
  };

  const clearDebug = () => {
    setLlmOutput("");
    setLlmError("");
  };

  return (
    <LinearGradient colors={gradients.canvas} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <LinearGradient colors={gradients.hero} style={styles.heroGlow} />
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
          }
        >
          <LinearGradient colors={gradients.panel} style={styles.recorderCard}>
            <View style={styles.recorderHeader}>
              <Text style={styles.sessionTitle}>会议快照</Text>
              <View style={styles.statusPill}>
                <View
                  style={[styles.statusDot, { backgroundColor: statusMeta.tone }]}
                />
                <Text style={styles.statusText}>{statusMeta.label}</Text>
              </View>
            </View>
          <View style={styles.timeMeta}>
            <Text style={styles.timerText}>
              {formatDuration(recorder.elapsedMs)}
            </Text>
            <Text style={styles.clockText}>
              {new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </View>
          <Text style={styles.tagline}>让每一次讨论都有清晰复盘</Text>
          <View style={styles.waveformWrap}>
            <Animated.View
                style={[
                  styles.waveform,
                  {
                    transform: [
                      {
                        scaleY: waveformAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.35, 1],
                        }),
                      },
                    ],
                  },
                ]}
              />
            </View>
            <Text style={styles.recordingHint}>{recordingHint}</Text>
            <View style={styles.controls}>
              <TouchableOpacity
                style={[
                  styles.secondaryButton,
                  isPauseResumeDisabled && styles.secondaryButtonDisabled,
                ]}
                onPress={handlePauseResume}
                disabled={isPauseResumeDisabled}
              >
                <Text style={styles.secondaryLabel}>
                  {recorder.status === "paused" ? "继续录制" : "暂时暂停"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleRecordToggle}>
                <LinearGradient
                  colors={gradients.accent}
                  style={[
                    styles.recordButton,
                    isRecording && styles.recordButtonActive,
                  ]}
                >
                  <Text style={styles.recordButtonText}>
                    {isRecording ? "停止录音" : "开始录音"}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </LinearGradient>

          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={styles.tab}
              activeOpacity={0.95}
              onPress={() => setActiveTab("transcription")}
            >
              <LinearGradient
                colors={
                  activeTab === "transcription"
                    ? gradients.tab
                    : ["transparent", "transparent"]
                }
                style={[
                  styles.tabInner,
                  activeTab === "transcription" && styles.tabActive,
                ]}
              >
                <Text
                  style={[
                    styles.tabLabel,
                    activeTab === "transcription" && styles.tabLabelActive,
                  ]}
                >
                  实时转写
                </Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.tab}
              activeOpacity={0.95}
              onPress={() => setActiveTab("summary")}
            >
              <LinearGradient
                colors={
                  activeTab === "summary"
                    ? gradients.tab
                    : ["transparent", "transparent"]
                }
                style={[
                  styles.tabInner,
                  activeTab === "summary" && styles.tabActive,
                ]}
              >
                <Text
                  style={[
                    styles.tabLabel,
                    activeTab === "summary" && styles.tabLabelActive,
                  ]}
                >
                  AI 总结
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {activeTab === "transcription" ? (
              <TranscriptionList segments={transcription} />
            ) : (
              <SummaryList cards={summaryCards} />
            )}
          </View>

          <View style={styles.debugPanel}>
            <View style={styles.debugHeader}>
              <Text style={styles.debugTitle}>调试输出</Text>
              <TouchableOpacity onPress={clearDebug}>
                <Text style={styles.debugClear}>清空</Text>
              </TouchableOpacity>
            </View>
            {llmError ? (
              <View style={[styles.debugMessage, styles.debugMessageError]}>
                <Text style={styles.debugLabel}>错误</Text>
                <Text style={styles.debugMono}>{llmError}</Text>
              </View>
            ) : null}
            {llmOutput ? (
              <View style={styles.debugMessage}>
                <Text style={styles.debugLabel}>最新结果</Text>
                <Text style={styles.debugMono}>{llmOutput}</Text>
              </View>
            ) : null}
            {!llmError && !llmOutput ? (
              <Text style={styles.debugHint}>
                尚未收到模型返回。完成音频推流后稍候几秒，可手动下拉刷新或触发技能查看结果。
              </Text>
            ) : null}
          </View>

          {/* 自动推送开关 */}
          <View style={styles.autoPushPanel}>
            <View style={styles.autoPushRow}>
              <Text style={styles.autoPushLabel}>自动推送分析</Text>
              <Switch
                value={autoPushEnabled}
                onValueChange={handleAutoPushToggle}
                trackColor={{ false: colors.backgroundAlt, true: colors.accent }}
                thumbColor={colors.panel}
              />
            </View>
            <Text style={styles.autoPushHint}>
              开启后每分钟自动分析会议状态并推送洞察
            </Text>
          </View>

          {/* 问答面板 */}
          <View style={styles.qaPanel}>
            <Text style={styles.qaPanelTitle}>会议问答</Text>
            {chatMessages.length > 0 && (
              <View style={styles.chatList}>
                {chatMessages.slice(-6).map((msg) => (
                  <View
                    key={msg.id}
                    style={[
                      styles.chatBubble,
                      msg.role === "user"
                        ? styles.chatBubbleUser
                        : styles.chatBubbleAssistant,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chatText,
                        msg.role === "user" && styles.chatTextUser,
                      ]}
                    >
                      {msg.content}
                    </Text>
                  </View>
                ))}
              </View>
            )}
            <View style={styles.qaInputRow}>
              <TextInput
                style={styles.qaInput}
                placeholder="输入问题，基于会议内容回答..."
                placeholderTextColor={colors.textMuted}
                value={qaQuestion}
                onChangeText={setQaQuestion}
                onSubmitEditing={handleAskQuestion}
                editable={!qaLoading}
              />
              <TouchableOpacity
                style={[styles.qaButton, qaLoading && styles.qaButtonDisabled]}
                onPress={handleAskQuestion}
                disabled={qaLoading || !qaQuestion.trim()}
              >
                <Text style={styles.qaButtonText}>
                  {qaLoading ? "..." : "发送"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        <View style={styles.skillPanel}>
          <SkillButton
            label="内心OS"
            state={skillState.inner_os}
            onPress={() => handleSkillTrigger("inner_os")}
          />
          <SkillButton
            label="头脑风暴"
            state={skillState.brainstorm}
            onPress={() => handleSkillTrigger("brainstorm")}
          />
          <SkillButton
            label="别再说了"
            state={skillState.stop_talking ?? "idle"}
            onPress={() => handleSkillTrigger("stop_talking")}
          />
        </View>
      </SafeAreaView>
    </LinearGradient>
  );

  function handleSkillTrigger(skill: "inner_os" | "brainstorm" | "stop_talking") {
    if (skillState[skill] === "loading") return;
    useSessionStore.getState().setSkillState(skill, "loading");
    (async () => {
      try {
        if (!sessionId) throw new Error("Session not initialized");
        const response = await sessionApi.triggerSkill(sessionId, skill);
        if (response.cards?.length) {
          useSessionStore.getState().upsertSummaryCards(response.cards);
          setActiveTab("summary");
        }
        noteResult(`技能 ${skill} 返回`, response);
        useSessionStore.getState().setSkillState(skill, "success");
      } catch (error) {
        console.error(error);
        noteError(`技能 ${skill} 触发失败`, error);
        useSessionStore.getState().setSkillState(skill, "error");
      } finally {
        setTimeout(() => {
          useSessionStore.getState().setSkillState(skill, "idle");
        }, 2000);
      }
    })();
  }

  async function handleAutoPushToggle(value: boolean) {
    if (!sessionId) return;
    setAutoPushEnabled(value);
    try {
      if (value) {
        await sessionApi.startAutoPush(sessionId);
        noteResult("自动推送已开启", { sessionId });
      } else {
        await sessionApi.stopAutoPush(sessionId);
        noteResult("自动推送已关闭", { sessionId });
      }
    } catch (error) {
      noteError("自动推送切换失败", error);
      setAutoPushEnabled(!value);
    }
  }

  async function handleAskQuestion() {
    if (!sessionId || !qaQuestion.trim() || qaLoading) return;
    setQaLoading(true);
    const question = qaQuestion.trim();
    setQaQuestion("");
    
    // 添加用户消息到本地
    setChatMessages((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        role: "user",
        content: question,
        timestamp: new Date().toISOString(),
        type: "qa",
      },
    ]);

    try {
      const response = await sessionApi.askQuestion(sessionId, question);
      setChatMessages((prev) => [
        ...prev,
        {
          id: response.messageId ?? `local-${Date.now()}`,
          role: "assistant",
          content: response.answer,
          timestamp: new Date().toISOString(),
          type: "qa",
        },
      ]);
      noteResult("问答结果", { question, answer: response.answer });
    } catch (error) {
      noteError("问答失败", error);
      setChatMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: "抱歉，处理问题时出错了，请稍后重试。",
          timestamp: new Date().toISOString(),
          type: "qa",
        },
      ]);
    } finally {
      setQaLoading(false);
    }
  }
};

const SkillButton = ({
  label,
  onPress,
  state,
}: {
  label: string;
  state: "idle" | "loading" | "success" | "error";
  onPress: () => void;
}) => {
  let indicator = "";
  if (state === "loading") indicator = " …";
  if (state === "success") indicator = " ✓";
  if (state === "error") indicator = " ⚠️";

  return (
    <TouchableOpacity style={styles.skillButton} onPress={onPress}>
      <LinearGradient colors={gradients.skill} style={styles.skillBadge}>
        <Text style={styles.skillBadgeText}>{label.slice(0, 1)}</Text>
      </LinearGradient>
      <Text style={styles.skillButtonText}>
        {label}
        {indicator}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  heroGlow: {
    position: "absolute",
    top: -140,
    left: -120,
    right: -120,
    height: 280,
    borderRadius: 260,
    opacity: 0.9,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 220,
  },
  recorderCard: {
    marginHorizontal: 20,
    marginTop: 24,
    borderRadius: 34,
    paddingHorizontal: 28,
    paddingVertical: 30,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.panelBorder,
    shadowColor: "#D2DAF3",
    shadowOpacity: 0.5,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 28 },
    elevation: 16,
  },
  recorderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  sessionTitle: {
    ...typography.display,
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: colors.accentMuted,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    ...typography.label,
    color: colors.textPrimary,
  },
  timeMeta: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  timerText: {
    ...typography.display,
    color: colors.textPrimary,
    fontSize: 34,
  },
  clockText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  tagline: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 10,
  },
  waveformWrap: {
    marginTop: 26,
    marginBottom: 22,
    height: 88,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#E1E6FF",
  },
  waveform: {
    flex: 1,
    backgroundColor: colors.accent,
    opacity: 0.55,
  },
  recordingHint: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: 24,
    width: "100%",
  },
  controls: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: colors.backgroundAlt,
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.panelBorder,
  },
  secondaryButtonDisabled: {
    opacity: 0.45,
  },
  secondaryLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  recordButton: {
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 24,
    shadowColor: colors.accent,
    shadowOpacity: 0.28,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 22,
    elevation: 10,
  },
  recordButtonActive: {
    shadowOpacity: 0.38,
  },
  recordButtonText: {
    ...typography.body,
    color: colors.accentContrast,
    fontWeight: "600",
  },
  tabContainer: {
    flexDirection: "row",
    marginTop: 28,
    marginHorizontal: 20,
    backgroundColor: colors.backgroundAlt,
    borderRadius: 24,
    padding: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.panelBorder,
  },
  tab: {
    flex: 1,
    borderRadius: 20,
    overflow: "hidden",
  },
  tabInner: {
    borderRadius: 18,
    paddingVertical: 12,
  },
  tabActive: {
    backgroundColor: colors.tabActive,
  },
  tabLabel: {
    ...typography.subheading,
    color: colors.textSecondary,
  },
  tabLabelActive: {
    color: colors.accentContrast,
  },
  content: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  debugPanel: {
    marginTop: 28,
    marginHorizontal: 20,
    padding: 18,
    borderRadius: 18,
    backgroundColor: colors.panel,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.panelBorder,
  },
  debugHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  debugTitle: {
    ...typography.subheading,
    color: colors.textPrimary,
  },
  debugClear: {
    ...typography.bodySmall,
    color: colors.accent,
  },
  debugMessage: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.backgroundAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.panelBorder,
  },
  debugMessageError: {
    backgroundColor: "#FEE2E2",
    borderColor: "#F87171",
  },
  debugLabel: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  debugMono: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textPrimary,
    fontFamily: Platform.select({
      ios: "Menlo",
      android: "monospace",
      default: "Menlo",
    }),
  },
  debugHint: {
    marginTop: 12,
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  skillPanel: {
    position: "absolute",
    bottom: 28,
    left: 20,
    right: 20,
    flexDirection: "row",
    backgroundColor: colors.panel,
    padding: 18,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.panelBorder,
    shadowColor: "#1B2B42",
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 18 },
    elevation: 9,
  },
  skillButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.backgroundAlt,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginHorizontal: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.panelBorder,
  },
  skillBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  skillBadgeText: {
    ...typography.label,
    color: colors.accentContrast,
  },
  skillButtonText: {
    ...typography.body,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  autoPushPanel: {
    marginTop: 20,
    marginHorizontal: 20,
    padding: 18,
    borderRadius: 18,
    backgroundColor: colors.panel,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.panelBorder,
  },
  autoPushRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  autoPushLabel: {
    ...typography.body,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  autoPushHint: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 8,
  },
  qaPanel: {
    marginTop: 20,
    marginHorizontal: 20,
    padding: 18,
    borderRadius: 18,
    backgroundColor: colors.panel,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.panelBorder,
  },
  qaPanelTitle: {
    ...typography.subheading,
    color: colors.textPrimary,
    marginBottom: 12,
  },
  chatList: {
    marginBottom: 12,
  },
  chatBubble: {
    padding: 12,
    borderRadius: 14,
    marginBottom: 8,
    maxWidth: "85%",
  },
  chatBubbleUser: {
    backgroundColor: colors.accent,
    alignSelf: "flex-end",
  },
  chatBubbleAssistant: {
    backgroundColor: colors.backgroundAlt,
    alignSelf: "flex-start",
  },
  chatText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  chatTextUser: {
    color: colors.accentContrast,
  },
  qaInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  qaInput: {
    flex: 1,
    backgroundColor: colors.backgroundAlt,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...typography.body,
    color: colors.textPrimary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.panelBorder,
  },
  qaButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
  },
  qaButtonDisabled: {
    opacity: 0.5,
  },
  qaButtonText: {
    ...typography.body,
    fontWeight: "600",
    color: colors.accentContrast,
  },
});

export default HomeScreen;


















