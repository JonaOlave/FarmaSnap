-- Inventario compartido de medicamentos de la casa.

create extension if not exists unaccent with schema extensions;

-- Minúsculas, sin tildes, espacios colapsados. IMMUTABLE para poder usarla en índices
-- (unaccent por sí sola no es inmutable).
create or replace function public.normalizar(texto text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(trim(regexp_replace(
    extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(texto, '')),
    '\s+', ' ', 'g'
  )));
$$;

create table public.medicamentos (
  id                    uuid primary key default gen_random_uuid(),
  nombre_comercial      text not null check (length(trim(nombre_comercial)) > 0),
  principios_activos    text[] not null default '{}',
  dosis                 text,
  forma                 text,
  laboratorio           text,
  cantidad_envases      integer not null default 1 check (cantidad_envases >= 0),
  foto_path             text,
  creado_en             timestamptz not null default now(),
  actualizado_en        timestamptz not null default now(),
  actualizado_por       uuid references auth.users (id) on delete set null,
  actualizado_por_email text
);

create unique index medicamentos_nombre_dosis_unico
  on public.medicamentos (public.normalizar(nombre_comercial), public.normalizar(coalesce(dosis, '')));

create or replace function public.medicamentos_antes_de_guardar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.nombre_comercial := trim(regexp_replace(new.nombre_comercial, '\s+', ' ', 'g'));
  new.principios_activos := coalesce(array(
    select distinct p
    from (select lower(trim(regexp_replace(x, '\s+', ' ', 'g'))) as p
          from unnest(new.principios_activos) as x) as t
    where p <> ''
    order by p
  ), '{}');
  new.dosis := nullif(trim(new.dosis), '');
  new.forma := nullif(lower(trim(new.forma)), '');
  new.laboratorio := nullif(trim(new.laboratorio), '');
  new.actualizado_en := now();
  new.actualizado_por := auth.uid();
  new.actualizado_por_email := auth.jwt() ->> 'email';
  return new;
end;
$$;

create trigger medicamentos_antes_de_guardar
  before insert or update on public.medicamentos
  for each row execute function public.medicamentos_antes_de_guardar();

-- Suma o resta envases en una sola sentencia (sin carreras) y nunca baja de 0.
create or replace function public.ajustar_envases(p_id uuid, p_delta integer)
returns public.medicamentos
language sql
security invoker
set search_path = ''
as $$
  update public.medicamentos
     set cantidad_envases = greatest(0, cantidad_envases + p_delta)
   where id = p_id
  returning *;
$$;

revoke execute on function public.ajustar_envases(uuid, integer) from public, anon;
grant execute on function public.ajustar_envases(uuid, integer) to authenticated;

alter table public.medicamentos enable row level security;

create policy "la familia con sesión gestiona el inventario"
  on public.medicamentos
  for all
  to authenticated
  using (true)
  with check (true);

alter publication supabase_realtime add table public.medicamentos;
