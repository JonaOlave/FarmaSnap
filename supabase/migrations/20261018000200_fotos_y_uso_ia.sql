-- Fotos de las cajas: bucket privado, accesible solo con sesión.
insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', false)
on conflict (id) do nothing;

create policy "la familia con sesión gestiona las fotos"
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'fotos')
  with check (bucket_id = 'fotos');

-- Conteo diario de análisis de IA por usuario (protege el crédito de Anthropic).
create table public.uso_ia (
  usuario  uuid not null references auth.users (id) on delete cascade,
  fecha    date not null default current_date,
  cantidad integer not null default 0,
  primary key (usuario, fecha)
);

alter table public.uso_ia enable row level security;
revoke all on public.uso_ia from anon, authenticated;

create or replace function public.registrar_uso_ia(p_limite integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario  uuid := auth.uid();
  v_cantidad integer;
begin
  if v_usuario is null then
    return false;
  end if;

  insert into public.uso_ia as u (usuario, fecha, cantidad)
  values (v_usuario, current_date, 1)
  on conflict (usuario, fecha) do update set cantidad = u.cantidad + 1
  returning u.cantidad into v_cantidad;

  return v_cantidad <= p_limite;
end;
$$;

revoke execute on function public.registrar_uso_ia(integer) from public, anon;
grant execute on function public.registrar_uso_ia(integer) to authenticated;
