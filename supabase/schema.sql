-- Esquema de la app "Gastos" para Supabase.
-- Ejecutar una sola vez en: Supabase → SQL Editor → New query → pegar → Run.
--
-- Principios de seguridad:
--  * Los datos (movimientos, cuentas, notas…) llegan YA CIFRADOS desde el móvil
--    (AES-256-GCM con una clave derivada de la contraseña del hogar). El servidor
--    solo guarda texto cifrado: ni Supabase ni el administrador pueden leerlo.
--  * Row Level Security: cada usuario solo ve las filas de los hogares de los que es miembro.
--  * Unirse a un hogar solo es posible con un código de invitación de un solo uso.

create extension if not exists pgcrypto;

-- ───────────── Tablas ─────────────
create table if not exists public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 60),
  salt        text not null,                 -- sal de PBKDF2 (base64), no es secreta
  verifier    text not null,                 -- texto conocido cifrado: sirve para comprobar la contraseña
  kdf_iter    int  not null default 600000,
  key_version int  not null default 1,
  created_by  uuid not null default auth.uid() references auth.users on delete cascade,
  created_at  timestamptz not null default now()
);

create table if not exists public.members (
  household_id uuid not null references public.households on delete cascade,
  user_id      uuid not null references auth.users on delete cascade,
  role         text not null default 'member' check (role in ('owner','member')),
  email        text,
  joined_at    timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table if not exists public.invites (
  code         text primary key,
  household_id uuid not null references public.households on delete cascade,
  created_by   uuid not null default auth.uid() references auth.users on delete cascade,
  expires_at   timestamptz not null default now() + interval '7 days',
  used_by      uuid references auth.users on delete set null,
  used_at      timestamptz
);

create table if not exists public.docs (
  household_id uuid not null references public.households on delete cascade,
  doc_id       text not null check (doc_id ~ '^[a-z0-9-]{1,40}$'),
  rev          int  not null default 1,
  key_version  int  not null default 1,
  iv           text not null,
  data         text not null check (char_length(data) < 4000000),
  updated_by   uuid default auth.uid() references auth.users on delete set null,
  updated_at   timestamptz not null default now(),
  primary key (household_id, doc_id)
);

create table if not exists public.devices (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  name         text check (char_length(name) <= 80),
  created_at   timestamptz not null default now(),
  last_seen    timestamptz not null default now(),
  revoked      boolean not null default false
);

-- ───────────── Funciones auxiliares ─────────────
create or replace function public.is_member(h uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where household_id = h and user_id = auth.uid())
$$;

create or replace function public.is_owner(h uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where household_id = h and user_id = auth.uid() and role = 'owner')
$$;

-- Crear un hogar y hacerse propietario en una sola operación
create or replace function public.create_household(p_name text, p_salt text, p_verifier text, p_iter int)
returns uuid language plpgsql security definer set search_path = public as $$
declare h uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if (select count(*) from public.members where user_id = auth.uid()) >= 5 then raise exception 'too_many_households'; end if;
  insert into public.households (name, salt, verifier, kdf_iter) values (p_name, p_salt, p_verifier, coalesce(p_iter, 600000))
    returning id into h;
  insert into public.members (household_id, user_id, role, email)
    values (h, auth.uid(), 'owner', (select email from auth.users where id = auth.uid()));
  return h;
end $$;

-- Unirse a un hogar con un código de invitación (un solo uso, caduca a los 7 días)
create or replace function public.join_household(p_code text)
returns table (id uuid, name text, salt text, verifier text, kdf_iter int, key_version int)
language plpgsql security definer set search_path = public as $$
declare inv public.invites;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into inv from public.invites i where i.code = upper(trim(p_code)) for update;
  if inv.code is null or inv.used_by is not null or inv.expires_at < now() then
    raise exception 'invalid_invite';
  end if;
  insert into public.members (household_id, user_id, role, email)
    values (inv.household_id, auth.uid(), 'member', (select email from auth.users u where u.id = auth.uid()))
    on conflict do nothing;
  update public.invites set used_by = auth.uid(), used_at = now() where code = inv.code;
  return query select h.id, h.name, h.salt, h.verifier, h.kdf_iter, h.key_version
    from public.households h where h.id = inv.household_id;
end $$;

revoke all on function public.create_household(text,text,text,int) from public, anon;
revoke all on function public.join_household(text) from public, anon;
grant execute on function public.create_household(text,text,text,int) to authenticated;
grant execute on function public.join_household(text) to authenticated;

-- ───────────── Row Level Security ─────────────
alter table public.households enable row level security;
alter table public.members    enable row level security;
alter table public.invites    enable row level security;
alter table public.docs       enable row level security;
alter table public.devices    enable row level security;

revoke all on public.households, public.members, public.invites, public.docs, public.devices from anon;

drop policy if exists hh_select on public.households;
drop policy if exists hh_update on public.households;
drop policy if exists hh_delete on public.households;
create policy hh_select on public.households for select to authenticated using (public.is_member(id));
create policy hh_update on public.households for update to authenticated using (public.is_member(id)) with check (public.is_member(id));
create policy hh_delete on public.households for delete to authenticated using (public.is_owner(id));

drop policy if exists mb_select on public.members;
drop policy if exists mb_delete on public.members;
create policy mb_select on public.members for select to authenticated using (public.is_member(household_id));
create policy mb_delete on public.members for delete to authenticated
  using (user_id = auth.uid() or public.is_owner(household_id));

drop policy if exists inv_select on public.invites;
drop policy if exists inv_insert on public.invites;
drop policy if exists inv_delete on public.invites;
create policy inv_select on public.invites for select to authenticated using (public.is_member(household_id));
create policy inv_insert on public.invites for insert to authenticated
  with check (public.is_member(household_id) and created_by = auth.uid());
create policy inv_delete on public.invites for delete to authenticated using (public.is_member(household_id));

drop policy if exists dc_all on public.docs;
create policy dc_all on public.docs for all to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));

drop policy if exists dv_select on public.devices;
drop policy if exists dv_insert on public.devices;
drop policy if exists dv_update on public.devices;
drop policy if exists dv_delete on public.devices;
create policy dv_select on public.devices for select to authenticated using (public.is_member(household_id));
create policy dv_insert on public.devices for insert to authenticated
  with check (public.is_member(household_id) and user_id = auth.uid());
create policy dv_update on public.devices for update to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy dv_delete on public.devices for delete to authenticated using (public.is_member(household_id));

-- Cada guardado incrementa la revisión (control de conflictos entre dispositivos)
create or replace function public.docs_touch() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;
drop trigger if exists docs_touch on public.docs;
create trigger docs_touch before insert or update on public.docs for each row execute function public.docs_touch();

-- ───────────── Keep-alive (ver supabase/keepalive.sql) ─────────────
create table if not exists public.keepalive (id integer primary key, nota text not null);
insert into public.keepalive (id, nota) values (1, 'ok') on conflict (id) do nothing;
alter table public.keepalive enable row level security;
revoke all on table public.keepalive from anon, authenticated;
grant select on table public.keepalive to anon, authenticated;
drop policy if exists keepalive_solo_lectura on public.keepalive;
create policy keepalive_solo_lectura on public.keepalive for select to anon, authenticated using (true);
