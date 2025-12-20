import { View, Text, StyleSheet } from "react-native";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";
import { SpeakerSegment } from "@/store/useSessionStore";

type Props = {
  segments: SpeakerSegment[];
};

const TranscriptionList = ({ segments }: Props) => {
  if (!segments.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>等待实时转写…</Text>
      </View>
    );
  }
  return (
    <>
      {segments.map((segment) => (
        <View style={styles.segment} key={segment.id}>
          <View style={styles.segmentHeader}>
            <View style={styles.speakerChip}>
              <Text style={styles.speakerText}>
                {segment.speakerId ? `发言者 ${segment.speakerId}` : "即时转写"}
              </Text>
            </View>
            <Text style={styles.segmentTimestamp}>
              {formatTimestamp(segment.startMs)}
            </Text>
          </View>
          <Text style={styles.segmentText}>{segment.text}</Text>
        </View>
      ))}
    </>
  );
};

const formatTimestamp = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
};

const styles = StyleSheet.create({
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  segment: {
    backgroundColor: colors.cardBackground,
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 22,
    marginBottom: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.panelBorder,
    shadowColor: "#C6D0ED",
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 14 },
    elevation: 6,
  },
  segmentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  speakerChip: {
    backgroundColor: colors.accentMuted,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
  },
  speakerText: {
    ...typography.label,
    color: colors.accent,
  },
  segmentTimestamp: {
    ...typography.caption,
    color: colors.textMuted,
  },
  segmentText: {
    ...typography.body,
    color: colors.textPrimary,
  },
});

export default TranscriptionList;
