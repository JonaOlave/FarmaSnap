begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

-- Partir de una tabla vacía; el rollback final deja los datos locales como estaban.
delete from public.medicamentos;

insert into auth.users (id, email)
values ('11111111-1111-1111-1111-111111111111', 'maria@familia.cl');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","email":"maria@familia.cl","role":"authenticated"}',
  true
);

insert into public.medicamentos (nombre_comercial, dosis, cantidad_envases) values ('Kitadol', '500 mg', 3);

select is((select caja_en_uso from public.medicamentos), false, 'un medicamento nuevo entra sin caja en uso');

update public.medicamentos set caja_en_uso = true;
select is((select caja_en_uso from public.medicamentos), true, 'un familiar puede marcar la caja en uso');

select is(
  (select caja_en_uso from public.ajustar_envases((select id from public.medicamentos), 1)),
  true, 'sumar un envase mantiene la caja en uso');

select is(
  (select caja_en_uso from public.ajustar_envases((select id from public.medicamentos), -1)),
  false, 'restar un envase termina la caja en uso');
select is((select cantidad_envases from public.medicamentos), 3, 'y descuenta el envase');

update public.medicamentos set cantidad_envases = 0, caja_en_uso = true;
select is((select caja_en_uso from public.medicamentos), false, 'sin stock no puede haber caja en uso');

update public.medicamentos set cantidad_envases = 1;
update public.medicamentos set caja_en_uso = true;
select is(
  (select caja_en_uso from public.ajustar_envases((select id from public.medicamentos), -5)),
  false, 'al quedar en 0 la marca se quita');

select * from finish();
rollback;
