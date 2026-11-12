import { amenities, roomTypes, today } from '@/lib/catalog';
import { answerMap, type Listing } from '@/lib/db';
import { AreaPicker } from './area-picker';
import { ActionForm } from './form';
import { LifestyleFields } from './lifestyle';

const rupee = (paise: number | null | undefined) => (paise === null || paise === undefined ? '' : String(paise / 100));
const plus = (iso: string, days: number) => new Date(Date.parse(iso) + days * 864e5).toISOString().slice(0, 10);
function Money({ name, label, value, hint, required = true }: { name: string; label: string; value?: number | null; hint?: string; required?: boolean }) {
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <div className="money"><input id={name} name={name} type="text" inputMode="decimal" pattern="\d{1,6}(\.\d{1,2})?" required={required} defaultValue={rupee(value) || (required ? '0' : '')} /></div>
      {hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}
function Pick({ name, label, options, value }: { name: string; label: string; options: readonly string[] | Record<string, string>; value?: string }) {
  const entries = Array.isArray(options) ? options.map(o => [o, o]) : Object.entries(options);
  return (
    <div className="field"><label htmlFor={name}>{label}</label>
      <select id={name} name={name} defaultValue={value ?? entries[0][0]}>{entries.map(([id, text]) => <option key={id} value={id}>{text}</option>)}</select></div>
  );
}
function Count({ name, label, value, min = 1 }: { name: string; label: string; value: number; min?: number }) {
  return <div className="field"><label htmlFor={name}>{label}</label><input id={name} name={name} type="number" inputMode="numeric" required min={min} max={20} defaultValue={value} /></div>;
}
export function ListingForm({ listing }: { listing?: Listing }) {
  const l = listing;
  const start = today();
  return (
    <ActionForm op="listing" submit={l ? 'Save changes' : 'Save draft'}>
      {l ? <input type="hidden" name="id" value={l.id} /> : null}
      <section className="card" aria-labelledby="s-room">
        <h2 id="s-room">The room</h2>
        <div className="field"><label htmlFor="title">Title</label><input id="title" name="title" type="text" required minLength={8} maxLength={90} defaultValue={l?.title ?? ''} placeholder="Sunny private room near the metro" /><span className="hint">No phone numbers, emails or links — they’re blocked in public text.</span></div>
        <div className="field"><label htmlFor="description">Description</label><textarea id="description" name="description" required minLength={10} maxLength={1200} defaultValue={l?.description ?? ''} placeholder="Who lives here, what the room and flat are like, and who would enjoy living here." /></div>
        <AreaPicker single city={l?.city_id ?? 'gurugram'} areas={l ? [l.locality_id] : []} cityName="city_id" areaName="locality_id" />
        <div className="cols">
          <Pick name="room_type" label="What’s on offer" options={roomTypes} value={l?.room_type} />
          <Pick name="building" label="Building type" options={['Society apartment', 'Independent floor', 'Standalone building', 'Other']} value={l?.building} />
          <Pick name="furnishing" label="Furnishing" options={['Unfurnished', 'Semi-furnished', 'Furnished']} value={l?.furnishing} />
          <Pick name="bath_sharing" label="Bathroom for this room" options={['Private', 'Shared']} value={l?.bath_sharing} />
          <Count name="rooms" label="Bedrooms in the flat" value={l?.rooms ?? 2} />
          <Count name="bathrooms" label="Bathrooms in the flat" value={l?.bathrooms ?? 1} />
          <Count name="occupants" label="People living there now" value={l?.occupants ?? 1} min={0} />
          <Count name="capacity" label="People when full" value={l?.capacity ?? 2} />
        </div>
        <fieldset><legend>Amenities</legend>
          <div className="checks inline">{amenities.map(a => <label key={a} className="check"><input type="checkbox" name="amenities" value={a} defaultChecked={l?.listing_amenities?.some(x => x.amenity === a)} />{a}</label>)}</div>
        </fieldset>
        <div className="field"><label htmlFor="transport">Getting around (optional)</label><input id="transport" name="transport" type="text" maxLength={300} defaultValue={l?.transport ?? ''} placeholder="10 minutes’ walk to the metro" /></div>
        <div className="field"><label htmlFor="restrictions">Restrictions or extra charges to know about (optional)</label><input id="restrictions" name="restrictions" type="text" maxLength={300} defaultValue={l?.restrictions ?? ''} placeholder="Society needs a police verification form" /></div>
      </section>
      <section className="card" aria-labelledby="s-cost" style={{ marginTop: 16 }}>
        <h2 id="s-cost">Costs, in rupees</h2>
        <p className="muted small">Enter this room’s share. Monthly and one-time amounts are shown to seekers separately.</p>
        <div className="cols">
          <Money name="rent" label="Monthly rent" value={l?.rent} />
          <Money name="maintenance" label="Monthly maintenance" value={l?.maintenance} />
          <Money name="utilities" label="Monthly utilities estimate" value={l?.utilities} required={false} hint="Leave blank if you don’t know. It will show as “not known”, not zero." />
          <Money name="recurring" label="Other fixed monthly charges" value={l?.recurring} hint="Cook, cleaner, Wi-Fi share and similar." />
          <Money name="deposit" label="Refundable deposit (one-time)" value={l?.deposit} />
          <Money name="brokerage" label="Brokerage (one-time)" value={l?.brokerage} />
          <Money name="fees" label="Move-in or admin fees (one-time)" value={l?.fees} />
        </div>
      </section>
      <section className="card" aria-labelledby="s-when" style={{ marginTop: 16 }}>
        <h2 id="s-when">Availability</h2>
        <div className="cols three">
          <div className="field"><label htmlFor="available_from">Available from</label><input id="available_from" name="available_from" type="date" required defaultValue={l?.available_from ?? start} /></div>
          <div className="field"><label htmlFor="available_until">Move-in by</label><input id="available_until" name="available_until" type="date" required min={start} defaultValue={l?.available_until ?? plus(start, 45)} /><span className="hint">Within 180 days of the start date.</span></div>
          <div className="field"><label htmlFor="min_months">Minimum stay (months)</label><input id="min_months" name="min_months" type="number" inputMode="numeric" required min={1} max={36} defaultValue={l?.min_months ?? 6} /></div>
        </div>
        <Pick name="poster_type" label="I am" options={{ Occupant: 'A current occupant', Owner: 'The owner' }} value={l?.poster_type} />
        <label className="check"><input type="checkbox" name="attested" required defaultChecked={Boolean(l)} />I confirm this vacancy is real and I have the right or permission to let or sub-let it.</label>
      </section>
      <section aria-labelledby="s-rules" style={{ margin: '16px 0' }}>
        <h2 id="s-rules">House rules and habits</h2>
        <p className="muted">Tap how this home runs. Seekers are matched against it.</p>
        <LifestyleFields mode="home" initial={answerMap(l?.household_preferences ?? [])} />
      </section>
      {l && l.status !== 'draft' ? <p className="note warn">Saving changes moves this listing back to draft, and it must be reviewed again before it is live.</p> : null}
    </ActionForm>
  );
}
