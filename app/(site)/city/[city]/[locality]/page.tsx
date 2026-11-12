import { CityPage, cityMetadata } from '@/components/city-page';

export const revalidate = 300;
type Props = { params: Promise<{ city: string; locality: string }> };
export async function generateMetadata({ params }: Props) { const p = await params; return cityMetadata(p.city, p.locality); }
export default async function Page({ params }: Props) { const p = await params; return <CityPage city={p.city} locality={p.locality} />; }
