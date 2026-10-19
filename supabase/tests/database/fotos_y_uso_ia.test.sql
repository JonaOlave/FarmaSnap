begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email)
values ('22222222-2222-2222-2222-222222222222', 'pedro@familia.cl');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","email":"pedro@familia.cl","role":"authenticated"}',
  true
);

select is(public.registrar_uso_ia(2), true,  'primer uso dentro del límite');
select is(public.registrar_uso_ia(2), true,  'segundo uso dentro del límite');
select is(public.registrar_uso_ia(2), false, 'tercer uso supera el límite');
select throws_ok($$ select * from public.uso_ia $$, '42501', null,
  'la tabla uso_ia no es accesible directamente');

reset role;
select is((select public from storage.buckets where id = 'fotos'), false,
  'el bucket fotos existe y es privado');

set local role anon;
select throws_ok($$ select public.registrar_uso_ia(100) $$, '42501', null,
  'anon no puede usar la IA');

select * from finish();
rollback;
