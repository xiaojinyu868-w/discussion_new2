import { View, Text, StyleSheet } from "react-native";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";
import { SummaryCard } from "@/store/useSessionStore";

const formatUpdatedAt = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
};

type Props = {
  cards: SummaryCard[];
};

const SummaryList = ({ cards }: Props) => {
  if (!cards.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>等待 AI 总结更新…</Text>
      </View>
    );
  }

  return (
    <>
      {cards.map((card) => (
        <View key={card.id} style={styles.card}>
          {card.title ? <Text style={styles.title}>{card.title}</Text> : null}
          {renderContent(card.content)}
          <Text style={styles.timestamp}>
            {formatUpdatedAt(card.updatedAt)}
          </Text>
        </View>
      ))}
    </>
  );
};

const renderContent = (content: string | string[] | Record<string, unknown>) => {
  if (Array.isArray(content)) {
    return content.map((item, index) => (
      <Text key={index} style={styles.body}>
        <Text style={styles.bullet}>•</Text> {item}
      </Text>
    ));
  }
  if (typeof content === "object" && content !== null) {
    return Object.entries(content).map(([key, value]) => (
      <Text key={key} style={styles.body}>
        <Text style={styles.bodyLabel}>{key}</Text> {String(value)}
      </Text>
    ));
  }
  return <Text style={styles.body}>{content}</Text>;
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
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.panelBorder,
    shadowColor: "#CCD5F0",
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 18 },
    elevation: 8,
  },
  title: {
    ...typography.heading,
    color: colors.textPrimary,
    marginBottom: 14,
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: 10,
  },
  bodyLabel: {
    ...typography.label,
    color: colors.textPrimary,
  },
  bullet: {
    color: colors.accent,
  },
  timestamp: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 12,
    alignSelf: "flex-end",
  },
});

export default SummaryList;

