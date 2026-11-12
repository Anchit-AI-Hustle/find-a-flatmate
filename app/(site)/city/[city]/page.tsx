import { CityPage, cityMetadata } from '@/components/city-page';

export const revalidate = 300;
type Props = { params: Promise<{ city: string }> };
export async function generateMetadata({ params }: Props) { return cityMetadata((await params).city); }
export default async function Page({ params }: Props) { return <CityPage city={(await params).city} />; }
