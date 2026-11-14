-- Keep-alive: tabla sin datos personales que GitHub consulta cada 3 días
-- para que Supabase no pause el proyecto gratuito por inactividad.
-- Ejecutar una vez en: Supabase → SQL Editor → New query → pegar → Run.
create table if not exists public.keepalive (
  id   integer primary key,
  nota text not null
);
insert into public.keepalive (id, nota) values (1, 'ok') on conflict (id) do nothing;
alter table public.keepalive enable row level security;
revoke all on table public.keepalive from anon, authenticated;
grant select on table public.keepalive to anon, authenticated;
drop policy if exists keepalive_solo_lectura on public.keepalive;
create policy keepalive_solo_lectura on public.keepalive for select to anon, authenticated using (true);
select * from public.keepalive;  -- debe mostrar: 1 | ok
