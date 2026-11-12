/** Friendly drawn face used instead of a photo. Deterministic per member; decorative, never a likeness. */
const skins = ['#f2c9a5', '#e0a878', '#c98a5e', '#a86f4a'];
const tops = ['#167c70', '#f08a72', '#e3b23c', '#5b7fc7', '#8a6fb5'];
const hair = ['#2b2420', '#3d2b1f', '#1f1b18', '#5a3a26'];
const styles = [
  'M22 44c-2-20 10-30 26-30s28 10 26 30c-6-10-14-14-26-14s-20 4-26 14z',
  'M20 50c-4-24 8-38 28-38s32 14 28 38c-2-12-6-18-10-20-6 4-26 4-36 0-4 2-8 8-10 20z',
  'M24 42c0-18 10-28 24-28s24 10 24 28c-4-8-8-12-12-13-8 3-16 3-24 0-4 1-8 5-12 13z',
  'M18 62c-6-30 8-50 30-50s36 20 30 50c-2-10-4-20-8-26-6 4-38 4-44 0-4 6-6 16-8 26z',
];
export function Doodle({ id, size = 52 }: { id: string; size?: number }) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const pick = <T,>(list: T[], shift: number) => list[(h >>> shift) % list.length];
  return (
    <svg className="doodle" width={size} height={size} viewBox="0 0 96 96" aria-hidden="true">
      <rect width="96" height="96" rx="28" fill="#e6f4ed" />
      <path d="M14 96c2-20 16-28 34-28s32 8 34 28z" fill={pick(tops, 2)} />
      <rect x="41" y="58" width="14" height="14" rx="6" fill={pick(skins, 5)} />
      <ellipse cx="48" cy="44" rx="21" ry="23" fill={pick(skins, 5)} />
      <path d={pick(styles, 8)} fill={pick(hair, 11)} />
      <circle cx="40" cy="46" r="2.4" fill="#162323" /><circle cx="56" cy="46" r="2.4" fill="#162323" />
      <path d="M40 55c4 5 12 5 16 0" fill="none" stroke="#162323" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="34" cy="52" r="3.5" fill="#f08a72" opacity=".45" /><circle cx="62" cy="52" r="3.5" fill="#f08a72" opacity=".45" />
    </svg>
  );
}
