import { expect, type Page } from '@playwright/test';
import { mailUrl } from '../support/local';

export const email = (label: string) => `${label}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@example.test`;

/** Reads the real magic-link email that local Supabase Auth sent to the local mail catcher. */
async function magicLink(address: string): Promise<string> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const found = await (await fetch(`${mailUrl}/api/v1/search?query=${encodeURIComponent(`to:${address}`)}`)).json() as { messages?: { ID: string }[] };
    const id = found.messages?.[0]?.ID;
    if (id) {
      const message = await (await fetch(`${mailUrl}/api/v1/message/${id}`)).json() as { Text?: string; HTML?: string };
      const link = `${message.HTML ?? ''} ${message.Text ?? ''}`.match(/https?:\/\/[^\s"'<>)]+\/auth\/v1\/verify[^\s"'<>)]+/)?.[0];
      if (link) return link.replaceAll('&amp;', '&');
    }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`No sign-in email arrived for ${address}`);
}
export async function signIn(page: Page, address: string) {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(address);
  await page.getByRole('button', { name: 'Email me a sign-in link' }).click();
  await expect(page.getByText('Check your email for a sign-in link')).toBeVisible();
  await page.goto(await magicLink(address));
  // New members are forwarded from /app to onboarding; wait for that chain to settle.
  await page.waitForLoadState('networkidle');
  await expect(page).toHaveURL(/\/(app|onboarding\/intent)$/);
}
type Basics = { name: string; intent: 'I’m looking for a room' | 'I have a room to fill' | 'I want to find a home together'; min?: string; max?: string };
export async function onboard(page: Page, { name, intent, min = '12000', max = '25000' }: Basics) {
  await page.goto('/onboarding/intent');
  await page.getByRole('button', { name: new RegExp(intent) }).click();
  await expect(page).toHaveURL(/\/onboarding\/basics/);
  await page.getByLabel('Display name').fill(name);
  await expect(page.getByRole('radio', { name: intent })).toBeChecked();
  await page.getByRole('checkbox', { name: 'Sector 56' }).check();
  await page.getByLabel('Monthly budget from').fill(min);
  await page.getByLabel('Monthly budget up to').fill(max);
  await page.getByLabel(/I confirm I am 18 or older/).check();
  await page.getByLabel(/I agree to the/).check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/onboarding\/lifestyle/);
  await page.getByLabel('My habit').first().selectOption('Early nights');
  await page.getByLabel('I’d like my flatmates to be').first().selectOption('Early nights');
  await page.locator('#smoking_habit').selectOption('No shared-space smoking');
  await page.locator('#smoking_want').selectOption('No shared-space smoking');
  await page.locator('#smoking_strength').selectOption('dealbreaker');
  await expect(page.getByText('2 of 14 answered')).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/onboarding\/preferences/);
  await page.getByLabel(/Help improve matching/).check();
  await page.getByRole('button', { name: 'Finish and activate my profile' }).click();
  await expect(page).toHaveURL(/\/onboarding\/complete/);
  await expect(page.getByRole('heading', { name: `You’re in, ${name}.` })).toBeVisible();
}
/** Fails the test on any console error or uncaught page error. */
export function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  return errors;
}
