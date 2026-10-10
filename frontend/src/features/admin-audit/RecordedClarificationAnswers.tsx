import { recordedObject, recordValue } from './RecordedCaseFields';

/** Use the immutable published questions, never the member's current profile. */
export default function RecordedClarificationAnswers({
  answers,
  questions,
}: {
  answers: Record<string, unknown>;
  questions: unknown[];
}) {
  const matched = new Set<string>();
  const rows = questions.flatMap((value) => {
    const question = recordedObject(value);
    if (typeof question?.id !== 'string') return [];
    matched.add(question.id);
    return [{ question: recordValue(question.label), answer: recordValue(answers[question.id]) }];
  });
  for (const [id, answer] of Object.entries(answers)) {
    if (!matched.has(id)) rows.push({ question: 'Question not recorded', answer: recordValue(answer) });
  }
  return (
    <section className="space-y-3">
      <h3 className="text-lg font-bold">Recorded clarification answers</h3>
      <dl className="space-y-3">
        {rows.map((row, index) => (
          <div key={index} className="rounded-xl border border-brand-border bg-brand-bg p-3">
            <dt className="text-sm font-semibold">{row.question}</dt>
            <dd className="mt-2 whitespace-pre-wrap text-sm">{row.answer}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
