import { z } from 'zod';

const token = z.string().regex(/^[0-9a-f]{64}$/, 'bad token');
const slug = z.string().regex(/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/);
const uuid = z.string().uuid();
/** Free text typed by a guest. Control characters are stripped; length is capped. Always rendered as plain text. */
const text = (max: number) =>
  z
    .string()
    .max(max * 2)
    .transform((s) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim())
    .pipe(z.string().max(max));

export const orderBody = z
  .object({
    slug,
    token,
    items: z
      .array(z.object({ item_id: uuid, qty: z.number().int().min(1).max(10), note: text(100).optional() }).strict())
      .min(1)
      .max(25),
    note: text(200).optional(),
    idempotency_key: z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/),
  })
  .strict();
export type OrderBody = z.infer<typeof orderBody>;

export const requestBody = z.discriminatedUnion('type', [
  z.object({ type: z.literal('waiter'), slug, token, reason: z.enum(['water', 'cutlery', 'cleaning', 'help', 'other']) }).strict(),
  z.object({ type: z.literal('bill'), slug, token, pay_mode: z.enum(['cash', 'upi', 'card']) }).strict(),
]);
export type RequestBody = z.infer<typeof requestBody>;

export const slugParam = slug;
