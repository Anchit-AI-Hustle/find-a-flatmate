import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';

export const mobileSecret = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const opaqueSecret = () => randomBytes(32).toString('base64url');
export const sha256 = (value: string) => createHash('sha256').update(value).digest('base64url');
