import { Check, CircleHelp, TriangleAlert } from 'lucide-react';
import type { matchPeople } from '@/lib/matching';

type Result = ReturnType<typeof matchPeople>;
const confidence = { low: 'Low confidence', medium: 'Medium confidence', high: 'High confidence' } as const;

export function Score({ result }: { result: Result }) {
  return (
    <div className="score">
      {result.score === null ? <b aria-label="No score">—</b> : <b>{result.score}<span className="sr"> out of 100</span></b>}
      <span>{result.hard_fail_reasons.length ? 'Not a fit' : result.score === null ? 'More info needed' : confidence[result.confidence]}</span>
    </div>
  );
}
/** Agreements, differences and gaps — never a lone percentage, never a safety rating. */
export function Fit({ result, limit = 3, full }: { result: Result; limit?: number; full?: boolean }) {
  const reasons = full ? result.top_reasons : result.top_reasons.slice(0, limit);
  const friction = [...result.hard_fail_reasons, ...result.potential_friction];
  const shownFriction = full ? friction : friction.slice(0, limit);
  return (
    <div className="fit">
      <ul>
        {reasons.map(r => <li key={r} className="good"><Check size={16} aria-hidden="true" /><span>{r}</span></li>)}
        {shownFriction.map(r => <li key={r} className="diff"><TriangleAlert size={16} aria-hidden="true" /><span>{r}</span></li>)}
        {result.missing_answers.length ? (
          <li className="miss"><CircleHelp size={16} aria-hidden="true" />
            <span>{full ? `Not answered yet: ${result.missing_answers.join(', ')}.` : `${result.missing_answers.length} topic${result.missing_answers.length === 1 ? '' : 's'} not answered by one of you.`}</span>
          </li>
        ) : null}
      </ul>
      {full ? <p className="hint">Scoring rules v{result.scoring_version}. A score reflects stated preferences only — it is not a safety check or a promise of harmony.</p> : null}
    </div>
  );
}
