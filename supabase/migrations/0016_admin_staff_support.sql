-- 0016_admin_staff_support
-- Platform admin can see a restaurant's logins and (through the server, which uses the Auth admin API) reset a
-- password or correct an email. service_role only; each function re-checks the platform_admins row and audits.
-- Idempotent. Rollback: drop the two functions.

create or replace function public.admin_list_staff(p_admin uuid, p_restaurant uuid)
returns table (user_id uuid, role text, display_name text, active boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin(p_admin);
  return query
    select s.user_id, s.role, s.display_name, s.active
      from public.staff s where s.restaurant_id = p_restaurant
     order by (s.role = 'owner') desc, s.created_at;
end $$;

create or replace function public.admin_check_staff(p_admin uuid, p_restaurant uuid, p_user uuid, p_action text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin(p_admin);
  if p_action not in ('staff_password_reset', 'staff_email_changed') then
    raise exception using errcode = 'GM012', message = 'not_found';
  end if;
  if not exists (select 1 from public.staff where user_id = p_user and restaurant_id = p_restaurant) then
    raise exception using errcode = 'GM012', message = 'not_found';
  end if;
  insert into public.audit_log (restaurant_id, actor_user_id, actor_role, action, entity, entity_id, details)
  values (p_restaurant, p_admin, 'platform_admin', p_action, 'staff', p_user::text, '{}'::jsonb);
end $$;

revoke all on function public.admin_list_staff(uuid, uuid), public.admin_check_staff(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_list_staff(uuid, uuid), public.admin_check_staff(uuid, uuid, uuid, text) to service_role;
