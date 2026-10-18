import { z } from 'zod';

const uuid = z.string().uuid();
const text = (max: number) => z.string().trim().min(1).max(max).regex(/^[^\u0000-\u001F\u007F]*$/);
const RESERVED = new Set(['admin','staff','dash','dashboard','api','login','logout','auth','_next','static','assets','health','privacy','terms','support','dev','public','app','www','mail','help','about','contact','signup','register','settings','account','status','favicon','robots','sitemap','manifest','sw','offline','images','img','menu','demo','test','null','undefined']);

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/, 'Use 3 to 40 letters, numbers or single hyphens')
  .refine((s) => !s.includes('--'), 'Use single hyphens only')
  .refine((s) => !RESERVED.has(s), 'That address is reserved');

const paidUntil = z.string().datetime({ offset: true }).nullable();

export const createRestaurant = z
  .object({
    slug: slugSchema,
    name: text(80),
    owner_email: z.string().trim().toLowerCase().email().max(254),
    owner_name: text(60),
    plan: text(30).default('pilot'),
    paid_until: paidUntil.default(null),
  })
  .strict();

export const setStatus = z.object({ id: uuid, status: z.enum(['active', 'suspended']) }).strict();
export const setPlan = z.object({ id: uuid, plan: text(30), paid_until: paidUntil }).strict();
export const restaurantQuery = z.object({ id: uuid });
export const deleteRestaurant = z.object({ id: uuid, confirm_slug: z.string().min(1).max(60) }).strict();
