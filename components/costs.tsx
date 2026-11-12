import { rupees, totals, type Costs } from '@/lib/catalog';

/** Itemised, receipt-style breakdown. Monthly costs and one-time move-in cash are never mixed. */
export function Receipt({ costs }: { costs: Costs }) {
  const t = totals(costs);
  return (
    <div className="receipt">
      <h4>Every month</h4>
      <dl>
        <dt>Rent</dt><dd>{rupees(costs.rent)}</dd>
        <dt>Maintenance</dt><dd>{rupees(costs.maintenance)}</dd>
        <dt>Utilities (estimate)</dt><dd>{costs.utilities === null ? 'Not known yet' : rupees(costs.utilities)}</dd>
        {costs.recurring ? <><dt>Other fixed charges</dt><dd>{rupees(costs.recurring)}</dd></> : null}
        <dt className="total">{t.incomplete ? 'Monthly total before utilities' : 'Estimated monthly total'}</dt><dd className="total">{rupees(t.monthly)}</dd>
      </dl>
      <h4>One-time, at move-in</h4>
      <dl>
        <dt>Refundable deposit</dt><dd>{rupees(costs.deposit)}</dd>
        <dt>Brokerage</dt><dd>{costs.brokerage ? rupees(costs.brokerage) : 'None'}</dd>
        <dt>Move-in or admin fees</dt><dd>{costs.fees ? rupees(costs.fees) : 'None'}</dd>
        <dt className="total">Cash needed to move in</dt><dd className="total">{rupees(t.initial)}</dd>
      </dl>
      <p className="hint" style={{ margin: '8px 0 0' }}>Move-in cash = first month + deposit + one-time fees. Figures are entered by the poster; confirm them in writing before paying.</p>
    </div>
  );
}
export function Price({ costs }: { costs: Costs }) {
  const t = totals(costs);
  return <p className="price" style={{ margin: 0 }}>{rupees(t.monthly)} <small>/ month {t.incomplete ? '+ utilities' : 'all-in estimate'}</small></p>;
}
