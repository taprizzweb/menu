/* eslint-disable @typescript-eslint/no-explicit-any -- each action's input type is fixed by its own zod schema */
import 'server-only';
import { ApiError } from '@/lib/errors';
import { jsonOk, type StaffCtx } from '@/lib/api/route';
import { temporaryPassword } from '@/lib/dash/temp-password';
import { rpc } from '@/lib/guest/rpc';
import { log } from '@/lib/log';
import * as S from '@/lib/schemas/admin';
import { adminClient } from '@/lib/supabase/admin';
import type { ZodType } from 'zod';

/** Platform-admin actions. Every one runs only after adminRoute() proved: signed in + own password + platform_admins row. */
export interface AdminAction {
  method: 'GET' | 'POST';
  schema?: ZodType<any>;
  run: (ctx: StaffCtx, input: any) => Promise<Response>;
}

const conflictOrThrow = (e: unknown): never => {
  const code = (e as { dbCode?: string }).dbCode;
  if (code === '23505') throw new ApiError(409, 'conflict');
  if (code === '23514') throw new ApiError(400, 'invalid_input');
  throw e;
};

export const ADMIN_ACTIONS: Record<string, AdminAction> = {
  restaurants: {
    method: 'GET',
    run: async (ctx) => jsonOk({ restaurants: await rpc('admin_list_restaurants', { p_admin: ctx.userId }) }, ctx.requestId),
  },

  'create-restaurant': {
    method: 'POST',
    schema: S.createRestaurant,
    run: async (ctx, b: ReturnType<typeof S.createRestaurant.parse>) => {
      const admin = adminClient();
      const password = temporaryPassword();
      const { data, error } = await admin.auth.admin.createUser({ email: b.owner_email, password, email_confirm: true, app_metadata: { must_change_password: true } });
      if (error || !data.user) {
        if (error && /already|exists|registered/i.test(error.message)) throw new ApiError(409, 'conflict');
        throw Object.assign(new Error('could not create owner login'), { dbCode: String(error?.status ?? '') });
      }
      try {
        const id = await rpc<string>('admin_create_restaurant', { p_admin: ctx.userId, p_slug: b.slug, p_name: b.name, p_owner_user_id: data.user.id, p_owner_name: b.owner_name, p_plan: b.plan, p_paid_until: b.paid_until });
        return jsonOk({ id, slug: b.slug, owner_email: b.owner_email, temporary_password: password }, ctx.requestId, { status: 201 });
      } catch (e) {
        await admin.auth.admin.deleteUser(data.user.id).catch(() => undefined); // no orphan login if the restaurant could not be made
        return conflictOrThrow(e);
      }
    },
  },

  'set-status': {
    method: 'POST',
    schema: S.setStatus,
    run: async (ctx, b) => {
      await rpc('admin_set_status', { p_admin: ctx.userId, p_restaurant: b.id, p_status: b.status });
      return jsonOk({ ok: true }, ctx.requestId);
    },
  },

  'set-plan': {
    method: 'POST',
    schema: S.setPlan,
    run: async (ctx, b) => {
      await rpc('admin_set_plan', { p_admin: ctx.userId, p_restaurant: b.id, p_plan: b.plan, p_paid_until: b.paid_until });
      return jsonOk({ ok: true }, ctx.requestId);
    },
  },

  audit: {
    method: 'GET',
    schema: S.restaurantQuery,
    run: async (ctx, q) => jsonOk({ entries: await rpc('admin_get_audit', { p_admin: ctx.userId, p_restaurant: q.id, p_limit: 200 }) }, ctx.requestId),
  },

  // Logins of one restaurant (owner first). Emails live in Supabase Auth, so they are looked up with the service key.
  staff: {
    method: 'GET',
    schema: S.restaurantQuery,
    run: async (ctx, q) => {
      const rows = (await rpc<{ user_id: string; role: string; display_name: string; active: boolean }[]>('admin_list_staff', { p_admin: ctx.userId, p_restaurant: q.id })) ?? [];
      const admin = adminClient();
      const staff = await Promise.all(
        rows.map(async (r) => {
          const { data } = await admin.auth.admin.getUserById(r.user_id);
          return { ...r, email: data?.user?.email ?? null };
        }),
      );
      return jsonOk({ staff }, ctx.requestId);
    },
  },

  // New login for a restaurant (owner, manager, waiter or kitchen) with a temporary password shown once.
  'staff-add': {
    method: 'POST',
    schema: S.staffAdd,
    run: async (ctx, b) => {
      const admin = adminClient();
      const password = temporaryPassword();
      const { data, error } = await admin.auth.admin.createUser({ email: b.email, password, email_confirm: true, app_metadata: { must_change_password: true } });
      if (error || !data.user) {
        if (error && /already|exists|registered/i.test(error.message)) throw new ApiError(409, 'conflict');
        throw Object.assign(new Error('could not create login'), { dbCode: String(error?.status ?? '') });
      }
      try {
        await rpc('admin_add_staff', { p_admin: ctx.userId, p_restaurant: b.id, p_user: data.user.id, p_role: b.role, p_name: b.name });
      } catch (e) {
        await admin.auth.admin.deleteUser(data.user.id).catch(() => undefined); // no orphan login if it could not be attached
        throw e;
      }
      return jsonOk({ user_id: data.user.id, email: b.email, temporary_password: password }, ctx.requestId, { status: 201 });
    },
  },

  // Forgotten password: a new temporary password, shown once, which the person must replace at their next sign-in.
  'staff-reset-password': {
    method: 'POST',
    schema: S.staffReset,
    run: async (ctx, b) => {
      await rpc('admin_check_staff', { p_admin: ctx.userId, p_restaurant: b.id, p_user: b.user_id, p_action: 'staff_password_reset' });
      const password = temporaryPassword();
      const { error } = await adminClient().auth.admin.updateUserById(b.user_id, { password, app_metadata: { must_change_password: true } });
      if (error) throw Object.assign(new Error('could not reset password'), { dbCode: String(error.status ?? '') });
      return jsonOk({ temporary_password: password }, ctx.requestId);
    },
  },

  // Wrong or changed email. The login keeps its password; the old email stops working at once.
  'staff-change-email': {
    method: 'POST',
    schema: S.staffEmail,
    run: async (ctx, b) => {
      await rpc('admin_check_staff', { p_admin: ctx.userId, p_restaurant: b.id, p_user: b.user_id, p_action: 'staff_email_changed' });
      const { error } = await adminClient().auth.admin.updateUserById(b.user_id, { email: b.email, email_confirm: true });
      if (error) {
        if (/already|exists|registered/i.test(error.message)) throw new ApiError(409, 'conflict');
        throw Object.assign(new Error('could not change email'), { dbCode: String(error.status ?? '') });
      }
      return jsonOk({ ok: true, email: b.email }, ctx.requestId);
    },
  },

  // JSON download of everything stored for one restaurant (data-portability / DPDP access). Audit-logged inside the SQL function.
  export: {
    method: 'GET',
    schema: S.restaurantQuery,
    run: async (ctx, q) => {
      const data = await rpc<unknown>('admin_export_restaurant', { p_admin: ctx.userId, p_restaurant: q.id });
      return new Response(JSON.stringify(data, null, 2), {
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8', 'content-disposition': 'attachment; filename="restaurant-export.json"', 'cache-control': 'no-store', 'x-request-id': ctx.requestId },
      });
    },
  },

  // Permanent. The slug must be typed exactly; the SQL function checks it again. Also removes the staff logins and the photos.
  'delete-restaurant': {
    method: 'POST',
    schema: S.deleteRestaurant,
    run: async (ctx, b) => {
      const users = await rpc<string[]>('admin_delete_restaurant', { p_admin: ctx.userId, p_restaurant: b.id, p_confirm_slug: b.confirm_slug });
      const admin = adminClient();
      for (const u of users ?? []) {
        const { error } = await admin.auth.admin.deleteUser(u);
        if (error) log('error', 'could not delete staff login after restaurant deletion', { requestId: ctx.requestId, userId: u });
      }
      try {
        const { data: files } = await admin.storage.from('menu-images').list(b.id, { limit: 1000 });
        if (files?.length) await admin.storage.from('menu-images').remove(files.map((f) => `${b.id}/${f.name}`));
      } catch {
        log('error', 'could not delete photos after restaurant deletion', { requestId: ctx.requestId });
      }
      return jsonOk({ ok: true, staff_logins_removed: users?.length ?? 0 }, ctx.requestId);
    },
  },
};
