import { View } from 'react-native';

import type { Question } from '@/game/questions';
import { useTheme } from '@/theme';
import { Flag } from '@/ui/Flag';
import { Text } from '@/ui/Text';

/**
 * The consigne, and what it is about. Shared by the game and the gauging, which
 * ask exactly the same thing and had drifted into two copies of it.
 */
export function QuestionPrompt({
  question,
  verdict,
}: {
  question: Question;
  /** Once answered, the pill carries the verdict instead of the question. */
  verdict?: { correct: boolean } | null;
}) {
  const theme = useTheme();

  const said = verdict
    ? verdict.correct
      ? { label: 'Juste', color: theme.colors.success }
      : { label: answerLabel(question), color: theme.colors.danger }
    : null;

  return (
    <View style={{ alignItems: 'center', gap: theme.space.md }}>
      <View
        style={{
          paddingHorizontal: theme.space.lg,
          paddingVertical: theme.space.sm,
          borderRadius: theme.radius.pill,
          backgroundColor: said
            ? verdict?.correct
              ? theme.colors.successSoft
              : theme.colors.dangerSoft
            : theme.colors.surfaceRaised,
          borderWidth: theme.borderWidth.hair,
          borderColor: said ? said.color : theme.colors.border,
          maxWidth: '100%',
        }}
      >
        <Text
          variant="label"
          align="center"
          numberOfLines={2}
          style={said ? { color: said.color } : undefined}
        >
          {said?.label ?? question.prompt}
        </Text>
      </View>

      {question.flagCode && !question.subject ? (
        <Flag cca2={question.flagCode} width={230} height={145} radius={theme.radius.sm} />
      ) : null}

      {question.subject ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }}>
          {question.flagCode ? (
            <Flag cca2={question.flagCode} height={34} radius={theme.radius.xs} />
          ) : null}
          <Text variant="display" numberOfLines={2} align="center">
            {question.subject}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function answerLabel(question: Question): string {
  if (question.mode === 'choice') {
    const answer = question.choices.find((c) => c.id === question.answerId);
    return answer ? `C’était ${answer.label}` : '';
  }
  return `C’était ${question.subject}`;
}
