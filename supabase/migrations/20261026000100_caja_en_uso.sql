-- Marca si una de las cajas del medicamento ya está abierta (en uso).

alter table public.medicamentos
  add column caja_en_uso boolean not null default false;

-- Sin stock no puede haber una caja en uso.
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
  if new.cantidad_envases = 0 then
    new.caja_en_uso := false;
  end if;
  new.actualizado_en := now();
  new.actualizado_por := auth.uid();
  new.actualizado_por_email := auth.jwt() ->> 'email';
  return new;
end;
$$;

-- Restar un envase significa que se terminó la caja abierta: la marca se quita.
create or replace function public.ajustar_envases(p_id uuid, p_delta integer)
returns public.medicamentos
language sql
security invoker
set search_path = ''
as $$
  update public.medicamentos
     set cantidad_envases = greatest(0, cantidad_envases + p_delta),
         caja_en_uso = case when p_delta < 0 then false else caja_en_uso end
   where id = p_id
  returning *;
$$;
