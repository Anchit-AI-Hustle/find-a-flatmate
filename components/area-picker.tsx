'use client';
import { useState } from 'react';
import { cities, type City } from '@/lib/catalog';

/** City select with the matching launch localities. `single` renders one locality select (listings). */
export function AreaPicker({ city, areas, single, cityName = 'city', areaName = 'areas' }: { city: string; areas: string[]; single?: boolean; cityName?: string; areaName?: string }) {
  const [current, setCurrent] = useState<City>(Object.hasOwn(cities, city) ? (city as City) : 'gurugram');
  const options = Object.entries(cities[current].areas);
  return (
    <div className="cols">
      <div className="field">
        <label htmlFor="city">City</label>
        <select id="city" name={cityName} value={current} onChange={e => setCurrent(e.target.value as City)}>
          {Object.entries(cities).map(([id, c]) => <option key={id} value={id}>{c.name}</option>)}
        </select>
      </div>
      {single ? (
        <div className="field">
          <label htmlFor="locality">Locality</label>
          <select id="locality" name={areaName} key={current} defaultValue={areas[0] ?? options[0][0]}>
            {options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          <span className="hint">Only the locality is shown publicly, never the address.</span>
        </div>
      ) : (
        <fieldset key={current}>
          <legend>Preferred localities</legend>
          <div className="checks">
            {options.map(([id, name]) => (
              <label key={id} className="check"><input type="checkbox" name={areaName} value={id} defaultChecked={areas.includes(id)} />{name}</label>
            ))}
          </div>
          <span className="hint">Pick at least one. We’re starting with a few localities so there are real matches.</span>
        </fieldset>
      )}
    </div>
  );
}
