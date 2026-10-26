begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

-- Partir de una tabla vacía; el rollback final deja los datos locales como estaban.
delete from public.medicamentos;

insert into auth.users (id, email)
values ('11111111-1111-1111-1111-111111111111', 'maria@familia.cl');

-- Actuar como un familiar con sesión
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","email":"maria@familia.cl","role":"authenticated"}',
  true
);

select lives_ok(
  $$ insert into public.medicamentos (nombre_comercial, principios_activos, dosis)
     values ('  Kitadol ', array['Paracetamol ', '', 'PARACETAMOL'], '500 mg') $$,
  'un familiar con sesión puede registrar'
);
select is((select nombre_comercial from public.medicamentos), 'Kitadol',
  'el nombre se guarda sin espacios sobrantes');
select is((select principios_activos from public.medicamentos), array['paracetamol'],
  'los principios se guardan en minúsculas, sin vacíos ni repetidos');
select is((select actualizado_por_email from public.medicamentos), 'maria@familia.cl',
  'el trigger registra quién hizo el cambio');

select throws_ok(
  $$ insert into public.medicamentos (nombre_comercial, dosis) values ('KITADOL', '500 MG') $$,
  '23505', null, 'no se puede duplicar aunque cambien las mayúsculas');
select throws_ok(
  $$ insert into public.medicamentos (nombre_comercial, dosis) values ('kitádol', ' 500  mg ') $$,
  '23505', null, 'ni con tildes o espacios distintos');
select lives_ok(
  $$ insert into public.medicamentos (nombre_comercial, dosis) values ('Kitadol', '1 g') $$,
  'otra dosis es otro producto');
select throws_ok(
  $$ insert into public.medicamentos (nombre_comercial, cantidad_envases) values ('Aspirina', -1) $$,
  '23514', null, 'la cantidad no puede ser negativa');
select throws_ok(
  $$ insert into public.medicamentos (nombre_comercial) values ('   ') $$,
  '23514', null, 'el nombre comercial es obligatorio');

select is(
  (select cantidad_envases from public.ajustar_envases(
     (select id from public.medicamentos where dosis = '500 mg'), 1)),
  2, 'sumar un envase');
select is(
  (select cantidad_envases from public.ajustar_envases(
     (select id from public.medicamentos where dosis = '500 mg'), -5)),
  0, 'restar nunca baja de 0');

-- Sin sesión
reset role;
set local role anon;
select is_empty($$ select * from public.medicamentos $$, 'anon no ve medicamentos');
select throws_ok(
  $$ insert into public.medicamentos (nombre_comercial) values ('X') $$,
  '42501', null, 'anon no puede registrar');

select * from finish();
rollback;
