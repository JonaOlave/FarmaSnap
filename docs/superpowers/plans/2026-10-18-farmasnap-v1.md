# FarmaSnap v1 — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir la app Android familiar FarmaSnap: inventario compartido de medicamentos, con registro y búsqueda por foto de la caja leída por IA.

**Architecture:** Una app Expo (React Native + TypeScript + Expo Router) habla con Supabase (Auth, Postgres con RLS, Storage, Realtime). Una Edge Function `analizar-foto` es la única pieza que conoce la clave de Anthropic y llama a `claude-haiku-5-5` con salida estructurada. La app descarga el inventario completo (es pequeño) y toda la lógica de búsqueda, duplicados y clasificación vive en un módulo TypeScript puro (`mobile/src/dominio`), probado con Jest.

**Tech Stack:** Expo SDK (última estable) · Expo Router · TypeScript · Jest (`jest-expo`) · Supabase (CLI vía npm, Postgres 15+, pgTAP, Edge Functions en Deno) · `@anthropic-ai/sdk` · `@supabase/supabase-js` v2 · EAS Build.

**Spec:** [`docs/superpowers/specs/2026-10-18-farmasnap-design.md`](../specs/2026-10-18-farmasnap-design.md)

## Global Constraints

- Modelo de IA: `claude-haiku-5-5`, con `output_config.format` de tipo `json_schema` y `effort: "low"`.
- La clave de Anthropic vive **solo** en los secretos de la Edge Function (`ANTHROPIC_API_KEY`); nunca en la app ni en el repositorio.
- Un único inventario compartido: RLS con una política "todo permitido" para `authenticated`; `anon` no accede a nada.
- `cantidad_envases >= 0`; llegar a 0 **no** borra el medicamento (se muestra "Sin stock").
- Unicidad: `normalizar(nombre_comercial)` + `normalizar(coalesce(dosis,''))`, donde `normalizar` = minúsculas, sin tildes, espacios colapsados y recortados. La app usa la misma normalización.
- Foto enviada a la IA: JPEG, lado mayor de 1000 px, calidad 0.7.
- Límite de IA: 100 análisis por usuario y día (`registrar_uso_ia`).
- Edge Function → Claude: tiempo de espera de 20 s y 1 reintento. App → Edge Function: corte a los 45 s.
- Principios activos: nombre genérico (DCI) en español y minúsculas.
- Toda la interfaz en español (Chile). Plataforma objetivo: Android con Expo Go para desarrollo y APK por EAS Build. **No** se usa Android Studio.
- Registro público desactivado en Supabase Auth; el administrador crea las cuentas.
- Commits con la identidad ya configurada en el repositorio (Jonathan Olave <jonathan.olave@outlook.com>), en la rama `development`.

## Review Focus

1. **El mismo producto existe pero está "Sin stock"** al buscar por foto → no debe decir "Ya lo tienes"; debe decir "No lo tienes" e indicar que se acabó (prueba en la Tarea 6).
2. **El mismo medicamento escrito distinto** ("KITADOL ", "kitádol", "500  MG") → debe tratarse como duplicado tanto en la app como en la base de datos (pruebas en las Tareas 1 y 7).
3. **La misma dosis escrita distinto** ("1 g", "1000 mg", "1000mg", "1,0 g") → debe considerarse la misma dosis (prueba en la Tarea 6).
4. **Combinaciones en otro orden o con otras mayúsculas** ("Cafeína, PARACETAMOL" frente a "paracetamol, cafeína") → deben contar como equivalentes (prueba en la Tarea 6).
5. **Caché ausente o corrupta sin conexión** (por ejemplo, en la farmacia sin señal) → la app no debe caerse; muestra la lista vacía o la última válida con el aviso (prueba en la Tarea 9).

---

## Estructura de archivos

```
FarmaSnap/
├── package.json                      # devDependency: supabase (CLI)
├── supabase/
│   ├── config.toml                   # generado por `supabase init`
│   ├── migrations/
│   │   ├── 20261018000100_medicamentos.sql
│   │   └── 20261018000200_fotos_y_uso_ia.sql
│   ├── tests/database/
│   │   ├── medicamentos.test.sql
│   │   └── fotos_y_uso_ia.test.sql
│   └── functions/analizar-foto/
│       ├── deno.json                 # import map
│       ├── logica.ts                 # esquema, instrucciones, validarExtraccion, base64Valido
│       ├── logica.test.ts
│       ├── claude.ts                 # extraerDeImagen (cliente inyectado)
│       ├── claude.test.ts
│       ├── handler.ts                # crearHandler (dependencias inyectadas)
│       ├── handler.test.ts
│       ├── index.ts                  # Deno.serve con dependencias reales
│       └── eval.ts                   # evaluación con fotos reales (manual)
├── eval/
│   ├── esperado.json                 # respuestas correctas de la evaluación
│   └── fotos/                        # (ignorado por git) fotos de cajas reales
├── docs/pruebas-manuales.md
└── mobile/                           # proyecto Expo
    ├── app.json · eas.json · .env.example · package.json
    ├── app/
    │   ├── _layout.tsx               # sesión + InventarioProvider + rutas protegidas
    │   ├── login.tsx
    │   ├── index.tsx                 # inventario
    │   ├── registrar.tsx
    │   ├── buscar-foto.tsx
    │   └── medicamento/[id].tsx      # detalle
    └── src/
        ├── dominio/                  # TS puro, sin React ni red
        │   ├── tipos.ts · normalizar.ts · dosis.ts · principios.ts
        │   ├── clasificar.ts · buscar.ts · formato.ts
        │   └── __tests__/*.test.ts
        ├── datos/                    # red, almacenamiento y estado compartido
        │   ├── supabase.ts · sesion.ts · medicamentos.ts · analizarFoto.ts
        │   ├── erroresFunciones.ts · dimensiones.ts · imagen.ts · cache.ts · capturaTemporal.ts
        │   ├── InventarioContext.tsx
        │   └── __tests__/*.test.ts
        └── ui/
            ├── tema.ts · Boton.tsx · confirmar.ts · AvisoConexion.tsx
            ├── MedicamentoItem.tsx · CapturaFoto.tsx
            └── FormularioMedicamento.tsx · ResultadoBusqueda.tsx
```

---

### Task 0: Prerrequisitos y cuentas (acción del usuario)

Esta tarea la hace **la persona usuaria**, porque requiere `sudo`, inicios de sesión interactivos y claves. El agente solo verifica.

- [ ] **Step 1: Instalar Docker** (lo necesita Supabase local para las pruebas de base de datos)

```bash
sudo apt install -y docker.io docker-compose-v2
sudo usermod -aG docker $USER
# Cerrar sesión de Linux y volver a entrar (o reiniciar) para que el grupo tenga efecto.
```

- [ ] **Step 2: Instalar Deno** (para las pruebas de la Edge Function)

```bash
curl -fsSL https://deno.land/install.sh | sh
# Seguir las indicaciones para agregar ~/.deno/bin al PATH y abrir una terminal nueva.
```

- [ ] **Step 3: Crear el proyecto de Supabase**
  1. Crear una cuenta en https://supabase.com y un proyecto llamado `farmasnap`, en la región **South America (São Paulo)**. Guardar la contraseña de la base de datos.
  2. En **Project Settings → API**, anotar la **Project URL**, la clave **anon / publishable** y el **Project ref** (el identificador de la URL).
  3. En **Authentication → Sign In / Providers**, desactivar **Allow new users to sign up**.
  4. En **Authentication → Users → Add user**, crear una cuenta por familiar (correo y contraseña, con **Auto Confirm User** activado).

- [ ] **Step 4: Crear la clave de Anthropic**
  En https://console.anthropic.com: cargar crédito (el mínimo alcanza para años de uso familiar) y crear una API key. **No pegarla en el chat ni en archivos del repositorio.**

- [ ] **Step 5: Preparar el teléfono**
  Instalar **Expo Go** desde Google Play en el Android de pruebas. Crear una cuenta en https://expo.dev (se usará en la Tarea 14).

- [ ] **Step 6: Verificar (el agente)**

Run:
```bash
docker run --rm hello-world | head -3
deno --version | head -1
node --version
```
Expected: el mensaje "Hello from Docker!", una versión de Deno y Node v20 o superior. Si alguno falla, detenerse y pedir a la persona usuaria que repita el paso correspondiente.

---

### Task 1: Base de datos — tabla `medicamentos`

**Files:**
- Create: `package.json`, `supabase/config.toml` (generado), `supabase/migrations/20261018000100_medicamentos.sql`
- Test: `supabase/tests/database/medicamentos.test.sql`
- Modify: `.gitignore`

**Interfaces:**
- Produces (SQL): `public.normalizar(text) returns text` (IMMUTABLE); tabla `public.medicamentos` (columnas: `id uuid`, `nombre_comercial text`, `principios_activos text[]`, `dosis text`, `forma text`, `laboratorio text`, `cantidad_envases int`, `foto_path text`, `creado_en timestamptz`, `actualizado_en timestamptz`, `actualizado_por uuid`, `actualizado_por_email text`); `public.ajustar_envases(p_id uuid, p_delta integer) returns public.medicamentos`; error `23505` ante duplicados.

- [ ] **Step 1: Preparar el CLI de Supabase y la carpeta**

Run (en la raíz del repositorio):
```bash
cd /home/jonathan/Documents/Projects/FarmaSnap
npm init -y >/dev/null
npm install --save-dev supabase
npx supabase init
```
Expected: se crea `supabase/config.toml`. Si `supabase init` pregunta por la configuración de VS Code o IntelliJ para Deno, responder `N`.

Agregar al final de `.gitignore`:
```gitignore
node_modules/
mobile/.env
eval/fotos/
```

- [ ] **Step 2: Escribir la prueba (falla)**

Create `supabase/tests/database/medicamentos.test.sql`:
```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

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
```

- [ ] **Step 3: Ejecutar la prueba para verificar que falla**

Run:
```bash
npx supabase start   # la primera vez descarga imágenes de Docker (varios minutos)
npx supabase test db
```
Expected: FAIL con `relation "public.medicamentos" does not exist`.

- [ ] **Step 4: Escribir la migración**

Create `supabase/migrations/20261018000100_medicamentos.sql`:
```sql
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
```

- [ ] **Step 5: Aplicar y ejecutar la prueba para verificar que pasa**

Run:
```bash
npx supabase db reset
npx supabase test db
```
Expected: `medicamentos.test.sql .. ok` y `All tests successful.`

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .gitignore supabase/
git commit -m "feat(db): tabla medicamentos con normalización, unicidad, RLS y ajuste atómico"
```

---

### Task 2: Base de datos — fotos y límite de uso de IA

**Files:**
- Create: `supabase/migrations/20261018000200_fotos_y_uso_ia.sql`
- Test: `supabase/tests/database/fotos_y_uso_ia.test.sql`

**Interfaces:**
- Consumes: el rol `authenticated` y `auth.uid()` (Task 1).
- Produces: bucket privado `fotos`; `public.registrar_uso_ia(p_limite integer) returns boolean` (true = dentro del límite).

- [ ] **Step 1: Escribir la prueba (falla)**

Create `supabase/tests/database/fotos_y_uso_ia.test.sql`:
```sql
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
```

- [ ] **Step 2: Ejecutar la prueba para verificar que falla**

Run: `npx supabase test db`
Expected: FAIL en `fotos_y_uso_ia.test.sql` con `function public.registrar_uso_ia(integer) does not exist`.

- [ ] **Step 3: Escribir la migración**

Create `supabase/migrations/20261018000200_fotos_y_uso_ia.sql`:
```sql
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
```

- [ ] **Step 4: Aplicar y ejecutar las pruebas para verificar que pasan**

Run:
```bash
npx supabase db reset
npx supabase test db
```
Expected: los dos archivos `.. ok` y `All tests successful.`

- [ ] **Step 5: Publicar las migraciones en el proyecto en la nube**

Run (la persona usuaria debe haber ejecutado `npx supabase login` antes; si no, pedírselo):
```bash
npx supabase link --project-ref <PROJECT_REF_DE_LA_TAREA_0>
npx supabase db push
```
Expected: `Finished supabase db push.` con las dos migraciones aplicadas. `link` pide la contraseña de la base de datos: la escribe la persona usuaria.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261018000200_fotos_y_uso_ia.sql supabase/tests/database/fotos_y_uso_ia.test.sql
git commit -m "feat(db): bucket privado de fotos y límite diario de uso de IA"
```

---

### Task 3: Edge Function — lógica pura de extracción

**Files:**
- Create: `supabase/functions/analizar-foto/deno.json`, `supabase/functions/analizar-foto/logica.ts`
- Test: `supabase/functions/analizar-foto/logica.test.ts`

**Interfaces:**
- Produces:
  - `MODELO = "claude-haiku-5-5"`, `LIMITE_DIARIO = 100`
  - `ESQUEMA` (JSON Schema de la extracción), `INSTRUCCIONES: string`
  - `interface Extraccion { legible: boolean; es_medicamento: boolean; nombre_comercial: string | null; principios_activos: string[]; dosis: string | null; forma: string | null; laboratorio: string | null }`
  - `validarExtraccion(dato: unknown): Extraccion` (lanza `Error("respuesta_invalida")`)
  - `base64Valido(valor: unknown): valor is string`

- [ ] **Step 1: Crear la función y el import map**

Run: `npx supabase functions new analizar-foto`
Expected: se crea `supabase/functions/analizar-foto/index.ts` (se reemplaza en la Tarea 4).

Replace `supabase/functions/analizar-foto/deno.json` with:
```json
{
  "imports": {
    "@anthropic-ai/sdk": "npm:@anthropic-ai/sdk",
    "@supabase/supabase-js": "npm:@supabase/supabase-js@2",
    "@std/assert": "jsr:@std/assert@1"
  }
}
```

- [ ] **Step 2: Escribir la prueba (falla)**

Create `supabase/functions/analizar-foto/logica.test.ts`:
```ts
import { assertEquals, assertThrows } from "@std/assert";
import { base64Valido, ESQUEMA, validarExtraccion } from "./logica.ts";

const completa = {
  legible: true,
  es_medicamento: true,
  nombre_comercial: " Kitadol ",
  principios_activos: ["Paracetamol"],
  dosis: "500 mg",
  forma: "Comprimidos",
  laboratorio: "Laboratorio Chile",
};

Deno.test("validarExtraccion recorta textos y normaliza principios y forma", () => {
  assertEquals(validarExtraccion(completa), {
    legible: true,
    es_medicamento: true,
    nombre_comercial: "Kitadol",
    principios_activos: ["paracetamol"],
    dosis: "500 mg",
    forma: "comprimidos",
    laboratorio: "Laboratorio Chile",
  });
});

Deno.test("validarExtraccion elimina principios vacíos, repetidos y no textuales", () => {
  const r = validarExtraccion({
    ...completa,
    principios_activos: ["Paracetamol", " paracetamol ", "", 42, "Cafeína"],
  });
  assertEquals(r.principios_activos, ["paracetamol", "cafeína"]);
});

Deno.test("sin nombre comercial la extracción no es legible", () => {
  const r = validarExtraccion({ ...completa, nombre_comercial: null });
  assertEquals(r.legible, false);
  assertEquals(r.nombre_comercial, null);
});

Deno.test("textos vacíos se convierten en null", () => {
  const r = validarExtraccion({ ...completa, dosis: "  ", forma: "", laboratorio: null });
  assertEquals([r.dosis, r.forma, r.laboratorio], [null, null, null]);
});

Deno.test("una respuesta que no es objeto se rechaza", () => {
  assertThrows(() => validarExtraccion("hola"), Error, "respuesta_invalida");
  assertThrows(() => validarExtraccion(null), Error, "respuesta_invalida");
});

Deno.test("el esquema cumple las reglas de salida estructurada", () => {
  assertEquals(ESQUEMA.additionalProperties, false);
  assertEquals([...ESQUEMA.required].sort(), Object.keys(ESQUEMA.properties).sort());
});

Deno.test("base64Valido acepta imágenes y rechaza valores inválidos", () => {
  assertEquals(base64Valido("A".repeat(200)), true);
  assertEquals(base64Valido("corto"), false);
  assertEquals(base64Valido(123), false);
  assertEquals(base64Valido("%%%" + "A".repeat(200)), false);
});
```

- [ ] **Step 3: Ejecutar la prueba para verificar que falla**

Run: `cd supabase/functions/analizar-foto && deno test`
Expected: FAIL con `Module not found ".../logica.ts"`.

- [ ] **Step 4: Escribir la implementación**

Create `supabase/functions/analizar-foto/logica.ts`:
```ts
export const MODELO = "claude-haiku-5-5";
export const LIMITE_DIARIO = 100;

const textoONulo = { anyOf: [{ type: "string" }, { type: "null" }] };

export const ESQUEMA = {
  type: "object",
  properties: {
    legible: { type: "boolean" },
    es_medicamento: { type: "boolean" },
    nombre_comercial: textoONulo,
    principios_activos: { type: "array", items: { type: "string" } },
    dosis: textoONulo,
    forma: textoONulo,
    laboratorio: textoONulo,
  },
  required: [
    "legible",
    "es_medicamento",
    "nombre_comercial",
    "principios_activos",
    "dosis",
    "forma",
    "laboratorio",
  ],
  additionalProperties: false,
} as const;

export const INSTRUCCIONES = `Lees fotos de cajas de medicamentos vendidos en Chile y extraes sus datos.

Reglas:
- nombre_comercial: la marca tal como aparece en la caja (por ejemplo "Kitadol", "Tapsin Día"). Si el producto se vende por su nombre genérico, usa ese nombre (por ejemplo "Paracetamol").
- principios_activos: cada principio activo con su nombre genérico (DCI) en español y en minúsculas, por ejemplo "paracetamol", nunca "acetaminofén" ni "Paracetamol 500 mg". Si hay varios, inclúyelos todos.
- dosis: la concentración principal como aparece, por ejemplo "500 mg", "1 g", "100 mg/5 ml".
- forma: comprimidos, cápsulas, jarabe, gotas, crema, suspensión, etc., en minúsculas.
- laboratorio: el fabricante si aparece.
- Si un dato no se lee con seguridad, devuelve null. Nunca inventes datos.
- legible: false si la foto está borrosa, cortada o no permite leer el nombre.
- es_medicamento: false si la foto no muestra un medicamento.`;

export interface Extraccion {
  legible: boolean;
  es_medicamento: boolean;
  nombre_comercial: string | null;
  principios_activos: string[];
  dosis: string | null;
  forma: string | null;
  laboratorio: string | null;
}

function textoONuloDe(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const recortado = valor.replace(/\s+/g, " ").trim();
  return recortado === "" ? null : recortado;
}

export function validarExtraccion(dato: unknown): Extraccion {
  if (typeof dato !== "object" || dato === null || Array.isArray(dato)) {
    throw new Error("respuesta_invalida");
  }
  const d = dato as Record<string, unknown>;
  const nombre = textoONuloDe(d.nombre_comercial);
  const principios = Array.isArray(d.principios_activos)
    ? [
      ...new Set(
        d.principios_activos
          .filter((p): p is string => typeof p === "string")
          .map((p) => p.replace(/\s+/g, " ").trim().toLowerCase())
          .filter((p) => p !== ""),
      ),
    ]
    : [];
  return {
    legible: d.legible === true && nombre !== null,
    es_medicamento: d.es_medicamento === true,
    nombre_comercial: nombre,
    principios_activos: principios,
    dosis: textoONuloDe(d.dosis),
    forma: textoONuloDe(d.forma)?.toLowerCase() ?? null,
    laboratorio: textoONuloDe(d.laboratorio),
  };
}

export function base64Valido(valor: unknown): valor is string {
  return typeof valor === "string" &&
    valor.length >= 100 &&
    valor.length <= 7_000_000 &&
    /^[A-Za-z0-9+/=\r\n]+$/.test(valor.slice(0, 500));
}
```

- [ ] **Step 5: Ejecutar la prueba para verificar que pasa**

Run: `cd supabase/functions/analizar-foto && deno test logica.test.ts`
Expected: `ok | 7 passed | 0 failed`.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/analizar-foto/deno.json supabase/functions/analizar-foto/logica.ts supabase/functions/analizar-foto/logica.test.ts
git commit -m "feat(ia): esquema, instrucciones y validación de la extracción de cajas"
```

---

### Task 4: Edge Function — llamada a Claude, handler y despliegue

**Files:**
- Create: `supabase/functions/analizar-foto/claude.ts`, `supabase/functions/analizar-foto/handler.ts`
- Modify (reemplazar): `supabase/functions/analizar-foto/index.ts`
- Test: `supabase/functions/analizar-foto/claude.test.ts`, `supabase/functions/analizar-foto/handler.test.ts`

**Interfaces:**
- Consumes: `MODELO`, `ESQUEMA`, `INSTRUCCIONES`, `Extraccion`, `validarExtraccion`, `base64Valido`, `LIMITE_DIARIO` (Task 3); RPC `registrar_uso_ia` (Task 2).
- Produces (contrato HTTP que usa la app en la Tarea 9):
  - `POST /functions/v1/analizar-foto` con `Authorization: Bearer <jwt>` y cuerpo `{ "imagen_base64": string }`.
  - `200` → `Extraccion` (JSON). `401` → `{error:"no_autorizado"}`. `400` → `{error:"cuerpo_invalido"|"imagen_invalida"}`. `405` → `{error:"metodo_no_permitido"}`. `429` → `{error:"limite_diario"}`. `502` → `{error:"ia_no_disponible"}`. `500` → `{error:"error_interno"}`.
  - TS: `interface ClienteMensajes`, `class ErrorExtraccion`, `extraerDeImagen(cliente, imagenBase64): Promise<Extraccion>`, `interface Dependencias`, `crearHandler(deps): (req: Request) => Promise<Response>`.

- [ ] **Step 1: Escribir las pruebas (fallan)**

Create `supabase/functions/analizar-foto/claude.test.ts`:
```ts
import { assertEquals, assertRejects } from "@std/assert";
import { type ClienteMensajes, ErrorExtraccion, extraerDeImagen } from "./claude.ts";
import { MODELO } from "./logica.ts";

function clienteFalso(respuesta: { stop_reason: string | null; content: Array<{ type: string; text?: string }> }) {
  const llamadas: Record<string, unknown>[] = [];
  const cliente: ClienteMensajes = {
    messages: {
      create(params) {
        llamadas.push(params);
        return Promise.resolve(respuesta);
      },
    },
  };
  return { cliente, llamadas };
}

const json = JSON.stringify({
  legible: true,
  es_medicamento: true,
  nombre_comercial: "Kitadol",
  principios_activos: ["Paracetamol"],
  dosis: "500 mg",
  forma: "comprimidos",
  laboratorio: null,
});

Deno.test("envía la imagen al modelo correcto con salida estructurada", async () => {
  const { cliente, llamadas } = clienteFalso({ stop_reason: "end_turn", content: [{ type: "text", text: json }] });
  const r = await extraerDeImagen(cliente, "QUJD");
  assertEquals(r.nombre_comercial, "Kitadol");
  assertEquals(r.principios_activos, ["paracetamol"]);
  const p = llamadas[0] as {
    model: string;
    output_config: { effort: string; format: { type: string } };
    messages: Array<{ content: Array<{ type: string; source?: { data: string; media_type: string } }> }>;
  };
  assertEquals(p.model, MODELO);
  assertEquals(p.output_config.effort, "low");
  assertEquals(p.output_config.format.type, "json_schema");
  const imagen = p.messages[0].content.find((b) => b.type === "image");
  assertEquals(imagen?.source?.data, "QUJD");
  assertEquals(imagen?.source?.media_type, "image/jpeg");
});

Deno.test("ignora bloques que no son de texto", async () => {
  const { cliente } = clienteFalso({
    stop_reason: "end_turn",
    content: [{ type: "thinking" }, { type: "text", text: json }],
  });
  assertEquals((await extraerDeImagen(cliente, "QUJD")).dosis, "500 mg");
});

Deno.test("una negativa o una respuesta cortada es un error", async () => {
  for (const stop_reason of ["refusal", "max_tokens"]) {
    const { cliente } = clienteFalso({ stop_reason, content: [{ type: "text", text: "{" }] });
    await assertRejects(() => extraerDeImagen(cliente, "QUJD"), ErrorExtraccion);
  }
});

Deno.test("una respuesta sin texto es un error", async () => {
  const { cliente } = clienteFalso({ stop_reason: "end_turn", content: [] });
  await assertRejects(() => extraerDeImagen(cliente, "QUJD"), ErrorExtraccion);
});
```

Create `supabase/functions/analizar-foto/handler.test.ts`:
```ts
import { assertEquals } from "@std/assert";
import { crearHandler, type Dependencias } from "./handler.ts";
import type { Extraccion } from "./logica.ts";

const extraccion: Extraccion = {
  legible: true,
  es_medicamento: true,
  nombre_comercial: "Kitadol",
  principios_activos: ["paracetamol"],
  dosis: "500 mg",
  forma: "comprimidos",
  laboratorio: null,
};
const IMAGEN = "A".repeat(200);

function deps(cambios: Partial<Dependencias> = {}): Dependencias {
  return {
    usuarioDesdeToken: () => Promise.resolve("usuario-1"),
    registrarUso: () => Promise.resolve(true),
    extraer: () => Promise.resolve(extraccion),
    ...cambios,
  };
}

function peticion(cuerpo: unknown, auth: string | null = "Bearer token", metodo = "POST") {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (auth) headers.set("Authorization", auth);
  return new Request("http://localhost/analizar-foto", {
    method: metodo,
    headers,
    body: metodo === "POST" ? (typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo)) : undefined,
  });
}

async function llamar(d: Dependencias, req: Request) {
  const res = await crearHandler(d)(req);
  return { estado: res.status, cuerpo: await res.json() };
}

Deno.test("200 con la extracción cuando todo está bien", async () => {
  const r = await llamar(deps(), peticion({ imagen_base64: IMAGEN }));
  assertEquals(r.estado, 200);
  assertEquals(r.cuerpo, extraccion);
});

Deno.test("401 sin cabecera de autorización o con token inválido", async () => {
  assertEquals((await llamar(deps(), peticion({ imagen_base64: IMAGEN }, null))).estado, 401);
  const invalido = deps({ usuarioDesdeToken: () => Promise.resolve(null) });
  assertEquals((await llamar(invalido, peticion({ imagen_base64: IMAGEN }))).estado, 401);
});

Deno.test("405 con un método distinto de POST", async () => {
  assertEquals((await llamar(deps(), peticion(null, "Bearer token", "GET"))).estado, 405);
});

Deno.test("400 con cuerpo que no es JSON o sin imagen válida", async () => {
  assertEquals((await llamar(deps(), peticion("no-json"))).cuerpo, { error: "cuerpo_invalido" });
  assertEquals((await llamar(deps(), peticion({ imagen_base64: "x" }))).cuerpo, { error: "imagen_invalida" });
});

Deno.test("429 cuando se supera el límite diario, sin llamar a la IA", async () => {
  let llamoIa = false;
  const d = deps({
    registrarUso: () => Promise.resolve(false),
    extraer: () => {
      llamoIa = true;
      return Promise.resolve(extraccion);
    },
  });
  assertEquals((await llamar(d, peticion({ imagen_base64: IMAGEN }))).estado, 429);
  assertEquals(llamoIa, false);
});

Deno.test("502 cuando la IA falla", async () => {
  const d = deps({ extraer: () => Promise.reject(new Error("timeout")) });
  assertEquals((await llamar(d, peticion({ imagen_base64: IMAGEN }))).cuerpo, { error: "ia_no_disponible" });
});

Deno.test("500 cuando falla el registro de uso", async () => {
  const d = deps({ registrarUso: () => Promise.reject(new Error("db caída")) });
  assertEquals((await llamar(d, peticion({ imagen_base64: IMAGEN }))).estado, 500);
});
```

- [ ] **Step 2: Ejecutar las pruebas para verificar que fallan**

Run: `cd supabase/functions/analizar-foto && deno test claude.test.ts handler.test.ts`
Expected: FAIL con `Module not found ".../claude.ts"` y `".../handler.ts"`.

- [ ] **Step 3: Implementar `claude.ts` y `handler.ts`**

Create `supabase/functions/analizar-foto/claude.ts`:
```ts
import { ESQUEMA, type Extraccion, INSTRUCCIONES, MODELO, validarExtraccion } from "./logica.ts";

/** Subconjunto del cliente de Anthropic que usamos; permite inyectar un cliente falso en pruebas. */
export interface ClienteMensajes {
  messages: {
    create(params: Record<string, unknown>): Promise<{
      stop_reason: string | null;
      content: Array<{ type: string; text?: string }>;
    }>;
  };
}

export class ErrorExtraccion extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = "ErrorExtraccion";
  }
}

export async function extraerDeImagen(cliente: ClienteMensajes, imagenBase64: string): Promise<Extraccion> {
  const respuesta = await cliente.messages.create({
    model: MODELO,
    max_tokens: 4000,
    system: INSTRUCCIONES,
    output_config: { effort: "low", format: { type: "json_schema", schema: ESQUEMA } },
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: imagenBase64 } },
        { type: "text", text: "Extrae los datos de esta caja de medicamento." },
      ],
    }],
  });

  if (respuesta.stop_reason !== "end_turn") {
    throw new ErrorExtraccion(`stop_reason=${respuesta.stop_reason}`);
  }
  const bloque = respuesta.content.find((b) => b.type === "text");
  if (!bloque?.text) throw new ErrorExtraccion("sin_texto");
  return validarExtraccion(JSON.parse(bloque.text));
}
```

Create `supabase/functions/analizar-foto/handler.ts`:
```ts
import { base64Valido, type Extraccion } from "./logica.ts";

export interface Dependencias {
  /** Devuelve el id del usuario si el token es válido; null si no. */
  usuarioDesdeToken(authorization: string): Promise<string | null>;
  /** Suma un uso del día; true si sigue dentro del límite. */
  registrarUso(authorization: string): Promise<boolean>;
  extraer(imagenBase64: string): Promise<Extraccion>;
}

function json(cuerpo: unknown, estado: number): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { "Content-Type": "application/json" },
  });
}

export function crearHandler(deps: Dependencias) {
  return async (req: Request): Promise<Response> => {
    try {
      if (req.method !== "POST") return json({ error: "metodo_no_permitido" }, 405);

      const authorization = req.headers.get("Authorization");
      if (!authorization || !(await deps.usuarioDesdeToken(authorization))) {
        return json({ error: "no_autorizado" }, 401);
      }

      let cuerpo: unknown;
      try {
        cuerpo = await req.json();
      } catch {
        return json({ error: "cuerpo_invalido" }, 400);
      }
      const imagen = (cuerpo as { imagen_base64?: unknown } | null)?.imagen_base64;
      if (!base64Valido(imagen)) return json({ error: "imagen_invalida" }, 400);

      if (!(await deps.registrarUso(authorization))) return json({ error: "limite_diario" }, 429);

      try {
        return json(await deps.extraer(imagen), 200);
      } catch (error) {
        console.error("Extracción fallida:", error);
        return json({ error: "ia_no_disponible" }, 502);
      }
    } catch (error) {
      console.error("Error interno:", error);
      return json({ error: "error_interno" }, 500);
    }
  };
}
```

- [ ] **Step 4: Ejecutar las pruebas para verificar que pasan**

Run: `cd supabase/functions/analizar-foto && deno test`
Expected: `ok | 18 passed | 0 failed` (7 de lógica + 4 de Claude + 7 del handler).

- [ ] **Step 5: Escribir `index.ts` con las dependencias reales**

Replace `supabase/functions/analizar-foto/index.ts` with:
```ts
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { type ClienteMensajes, extraerDeImagen } from "./claude.ts";
import { crearHandler } from "./handler.ts";
import { LIMITE_DIARIO } from "./logica.ts";

const anthropic = new Anthropic({
  apiKey: Deno.env.get("ANTHROPIC_API_KEY"),
  maxRetries: 1, // un reintento ante 429/5xx/red
  timeout: 20_000, // milisegundos
});

function clienteDelUsuario(authorization: string) {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

Deno.serve(crearHandler({
  async usuarioDesdeToken(authorization) {
    const token = authorization.replace(/^Bearer\s+/i, "");
    const { data, error } = await clienteDelUsuario(authorization).auth.getUser(token);
    return error ? null : data.user?.id ?? null;
  },
  async registrarUso(authorization) {
    const { data, error } = await clienteDelUsuario(authorization).rpc("registrar_uso_ia", {
      p_limite: LIMITE_DIARIO,
    });
    if (error) throw error;
    return data === true;
  },
  extraer: (imagen) => extraerDeImagen(anthropic as unknown as ClienteMensajes, imagen),
}));
```

Run: `cd supabase/functions/analizar-foto && deno check index.ts`
Expected: sin errores de tipos.

- [ ] **Step 6: Configurar el secreto y desplegar**

La persona usuaria ejecuta (la clave no debe pasar por el agente):
```bash
npx supabase secrets set ANTHROPIC_API_KEY=<su_clave>
```
Luego el agente despliega:
```bash
npx supabase functions deploy analizar-foto
```
Expected: `Deployed Functions on project <ref>: analizar-foto`.

- [ ] **Step 7: Prueba de humo contra la nube**

Run:
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  "https://<PROJECT_REF>.supabase.co/functions/v1/analizar-foto" \
  -H "Content-Type: application/json" -d '{"imagen_base64":"x"}'
```
Expected: `401`. La función rechaza peticiones sin sesión, ya sea por la verificación de JWT de la plataforma o por el handler.

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/analizar-foto/
git commit -m "feat(ia): Edge Function analizar-foto con Claude Haiku, autenticación y límite diario"
```

---

### Task 5: App — proyecto Expo, Jest, tipos y normalización

**Files:**
- Create: `mobile/` (generado), `mobile/src/dominio/tipos.ts`, `mobile/src/dominio/normalizar.ts`, `mobile/.env.example`
- Test: `mobile/src/dominio/__tests__/normalizar.test.ts`
- Modify: `mobile/package.json` (scripts y jest), `mobile/app.json`

**Interfaces:**
- Produces:
  - `interface DatosMedicamento { nombre_comercial: string; principios_activos: string[]; dosis: string | null; forma: string | null; laboratorio: string | null }`
  - `interface Medicamento extends DatosMedicamento { id: string; cantidad_envases: number; foto_path: string | null; creado_en: string; actualizado_en: string; actualizado_por_email: string | null }`
  - `interface ValoresFormulario extends DatosMedicamento { cantidad_envases: number }`
  - `interface Extraccion` (idéntica a la de la Edge Function)
  - `interface CoincidenciaEquivalente { medicamento: Medicamento; dosisDistinta: boolean }`
  - `type ResultadoBusqueda = { tipo: "tiene"; medicamento: Medicamento } | { tipo: "equivalente"; coincidencias: CoincidenciaEquivalente[] } | { tipo: "no_tiene"; agotado: Medicamento | null }`
  - `normalizar(texto: string | null | undefined): string`

- [ ] **Step 1: Crear el proyecto Expo**

Run:
```bash
cd /home/jonathan/Documents/Projects/FarmaSnap
npx create-expo-app@latest mobile --yes
cd mobile
printf 'n\n' | npm run reset-project
rm -rf app-example
npm pkg delete scripts.reset-project
```
Expected: `mobile/app/index.tsx` y `mobile/app/_layout.tsx` mínimos. Si `create-expo-app` crea un `.git` propio dentro de `mobile/`, eliminarlo (`rm -rf mobile/.git`), porque el repositorio es la raíz.

- [ ] **Step 2: Instalar dependencias y configurar Jest**

Run (en `mobile/`):
```bash
npx expo install @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill expo-camera expo-image-manipulator @react-native-community/netinfo
npm install base64-arraybuffer
npx expo install jest-expo jest @types/jest -- --save-dev
npm pkg set scripts.test="jest" scripts.typecheck="tsc --noEmit" jest.preset="jest-expo"
```

Edit `mobile/app.json`: dentro de `"expo"`, poner `"name": "FarmaSnap"`, `"slug": "farmasnap"`, `"scheme": "farmasnap"`, agregar `"android": { ... "package": "com.jonaolave.farmasnap" }` (conservando lo que ya tenga `android`) y agregar al arreglo `"plugins"`:
```json
["expo-camera", { "cameraPermission": "FarmaSnap usa la cámara para leer las cajas de los medicamentos." }]
```

Create `mobile/.env.example`:
```bash
EXPO_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=tu-clave-anon-o-publishable
```

- [ ] **Step 3: Escribir la prueba (falla)**

Create `mobile/src/dominio/__tests__/normalizar.test.ts`:
```ts
import { normalizar } from '../normalizar';

describe('normalizar', () => {
  it('pasa a minúsculas y quita tildes', () => {
    expect(normalizar('Ibuprofeno')).toBe('ibuprofeno');
    expect(normalizar('Cafeína')).toBe('cafeina');
    expect(normalizar('Tapsin DÍA')).toBe('tapsin dia');
  });

  it('colapsa y recorta espacios', () => {
    expect(normalizar('  500   MG ')).toBe('500 mg');
  });

  it('trata null y undefined como texto vacío', () => {
    expect(normalizar(null)).toBe('');
    expect(normalizar(undefined)).toBe('');
  });

  it('convierte ñ en n, igual que unaccent en la base de datos', () => {
    expect(normalizar('Niño')).toBe('nino');
  });
});
```

- [ ] **Step 4: Ejecutar la prueba para verificar que falla**

Run (en `mobile/`): `npx jest src/dominio`
Expected: FAIL con `Cannot find module '../normalizar'`.

- [ ] **Step 5: Implementar tipos y normalización**

Create `mobile/src/dominio/tipos.ts`:
```ts
export interface DatosMedicamento {
  nombre_comercial: string;
  principios_activos: string[];
  dosis: string | null;
  forma: string | null;
  laboratorio: string | null;
}

export interface Medicamento extends DatosMedicamento {
  id: string;
  cantidad_envases: number;
  foto_path: string | null;
  creado_en: string;
  actualizado_en: string;
  actualizado_por_email: string | null;
}

export interface ValoresFormulario extends DatosMedicamento {
  cantidad_envases: number;
}

/** Respuesta de la Edge Function `analizar-foto`. */
export interface Extraccion {
  legible: boolean;
  es_medicamento: boolean;
  nombre_comercial: string | null;
  principios_activos: string[];
  dosis: string | null;
  forma: string | null;
  laboratorio: string | null;
}

export interface CoincidenciaEquivalente {
  medicamento: Medicamento;
  dosisDistinta: boolean;
}

export type ResultadoBusqueda =
  | { tipo: 'tiene'; medicamento: Medicamento }
  | { tipo: 'equivalente'; coincidencias: CoincidenciaEquivalente[] }
  | { tipo: 'no_tiene'; agotado: Medicamento | null };
```

Create `mobile/src/dominio/normalizar.ts`:
```ts
/** Igual que `public.normalizar` en Postgres: minúsculas, sin tildes, espacios colapsados. */
export function normalizar(texto: string | null | undefined): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
```

- [ ] **Step 6: Ejecutar las pruebas y el chequeo de tipos**

Run (en `mobile/`): `npx jest src/dominio && npm run typecheck`
Expected: `Tests: 4 passed` y `tsc` sin errores.

- [ ] **Step 7: Commit**

```bash
cd /home/jonathan/Documents/Projects/FarmaSnap
git add mobile/
git commit -m "feat(app): proyecto Expo con Jest, tipos de dominio y normalización"
```

---

### Task 6: Dominio — dosis, principios activos y clasificación de la búsqueda por foto

**Files:**
- Create: `mobile/src/dominio/dosis.ts`, `mobile/src/dominio/principios.ts`, `mobile/src/dominio/clasificar.ts`
- Test: `mobile/src/dominio/__tests__/dosis.test.ts`, `mobile/src/dominio/__tests__/clasificar.test.ts`

**Interfaces:**
- Consumes: `normalizar`, `Medicamento`, `DatosMedicamento`, `ResultadoBusqueda` (Task 5).
- Produces:
  - `parsearDosis(texto: string | null): { valor: number; unidad: string } | null`
  - `mismaDosis(a: string | null, b: string | null): boolean` (si a una le falta la dosis, son compatibles)
  - `mismosPrincipios(a: string[], b: string[]): boolean` (conjuntos iguales; si alguno está vacío, false)
  - `clasificarResultado(buscado: Pick<DatosMedicamento, 'nombre_comercial' | 'principios_activos' | 'dosis'>, inventario: Medicamento[]): ResultadoBusqueda`

- [ ] **Step 1: Escribir las pruebas (fallan)**

Create `mobile/src/dominio/__tests__/dosis.test.ts`:
```ts
import { mismaDosis, parsearDosis } from '../dosis';
import { mismosPrincipios } from '../principios';

describe('parsearDosis', () => {
  it('convierte a una unidad base', () => {
    expect(parsearDosis('1 g')).toEqual({ valor: 1000, unidad: 'mg' });
    expect(parsearDosis('500mg')).toEqual({ valor: 500, unidad: 'mg' });
    expect(parsearDosis('250 mcg')).toEqual({ valor: 0.25, unidad: 'mg' });
    expect(parsearDosis('1,5 G')).toEqual({ valor: 1500, unidad: 'mg' });
    expect(parsearDosis('0.5 l')).toEqual({ valor: 500, unidad: 'ml' });
  });

  it('devuelve null si no puede interpretar', () => {
    expect(parsearDosis('100 mg/5 ml')).toBeNull();
    expect(parsearDosis('')).toBeNull();
    expect(parsearDosis(null)).toBeNull();
  });
});

describe('mismaDosis', () => {
  it('reconoce la misma dosis escrita distinto', () => {
    expect(mismaDosis('1 g', '1000 mg')).toBe(true);
    expect(mismaDosis('1000mg', '1,0 g')).toBe(true);
    expect(mismaDosis('500 MG', '500 mg')).toBe(true);
  });

  it('distingue dosis distintas', () => {
    expect(mismaDosis('500 mg', '1 g')).toBe(false);
    expect(mismaDosis('5 ml', '5 mg')).toBe(false);
  });

  it('compara como texto lo que no puede interpretar', () => {
    expect(mismaDosis('100 mg/5 ml', '100 MG/5 ML')).toBe(true);
    expect(mismaDosis('100 mg/5 ml', '200 mg/5 ml')).toBe(false);
  });

  it('considera compatibles si a una le falta la dosis', () => {
    expect(mismaDosis(null, '500 mg')).toBe(true);
    expect(mismaDosis('500 mg', '  ')).toBe(true);
    expect(mismaDosis(null, null)).toBe(true);
  });
});

describe('mismosPrincipios', () => {
  it('ignora orden, mayúsculas y tildes', () => {
    expect(mismosPrincipios(['Cafeína', 'PARACETAMOL'], ['paracetamol', 'cafeina'])).toBe(true);
  });

  it('exige el mismo conjunto', () => {
    expect(mismosPrincipios(['paracetamol'], ['paracetamol', 'cafeína'])).toBe(false);
  });

  it('nunca considera equivalente una lista vacía', () => {
    expect(mismosPrincipios([], [])).toBe(false);
    expect(mismosPrincipios(['paracetamol'], [])).toBe(false);
  });
});
```

Create `mobile/src/dominio/__tests__/clasificar.test.ts`:
```ts
import { clasificarResultado } from '../clasificar';
import type { Medicamento } from '../tipos';

function med(parcial: Partial<Medicamento> & Pick<Medicamento, 'id' | 'nombre_comercial'>): Medicamento {
  return {
    principios_activos: [],
    dosis: null,
    forma: null,
    laboratorio: null,
    cantidad_envases: 1,
    foto_path: null,
    creado_en: '2026-10-18T10:00:00Z',
    actualizado_en: '2026-10-18T10:00:00Z',
    actualizado_por_email: null,
    ...parcial,
  };
}

const kitadol500 = med({ id: 'k5', nombre_comercial: 'Kitadol', principios_activos: ['paracetamol'], dosis: '500 mg', cantidad_envases: 2 });
const paracetamol1g = med({ id: 'p1', nombre_comercial: 'Paracetamol Lab. Chile', principios_activos: ['paracetamol'], dosis: '1 g' });
const tapsin = med({ id: 't', nombre_comercial: 'Tapsin Día', principios_activos: ['paracetamol', 'fenilefrina'] });
const loratadinaAgotada = med({ id: 'l', nombre_comercial: 'Loratadina', principios_activos: ['loratadina'], dosis: '10 mg', cantidad_envases: 0 });
const inventario = [kitadol500, paracetamol1g, tapsin, loratadinaAgotada];

describe('clasificarResultado', () => {
  it('"tiene" con el mismo nombre y dosis, aunque cambien mayúsculas y unidades', () => {
    const r = clasificarResultado({ nombre_comercial: 'KITADOL', principios_activos: ['paracetamol'], dosis: '0,5 g' }, inventario);
    expect(r).toEqual({ tipo: 'tiene', medicamento: kitadol500 });
  });

  it('"equivalente" con el mismo principio activo, primero los de la misma dosis', () => {
    const r = clasificarResultado({ nombre_comercial: 'Panadol', principios_activos: ['Paracetamol'], dosis: '1000 mg' }, inventario);
    expect(r).toEqual({
      tipo: 'equivalente',
      coincidencias: [
        { medicamento: paracetamol1g, dosisDistinta: false },
        { medicamento: kitadol500, dosisDistinta: true },
      ],
    });
  });

  it('no mezcla combinaciones con productos simples', () => {
    const r = clasificarResultado({ nombre_comercial: 'Tapsin Noche', principios_activos: ['fenilefrina', 'paracetamol'], dosis: null }, inventario);
    expect(r).toEqual({ tipo: 'equivalente', coincidencias: [{ medicamento: tapsin, dosisDistinta: false }] });
  });

  it('el mismo producto sin stock NO cuenta como "tiene" y se informa como agotado', () => {
    const r = clasificarResultado({ nombre_comercial: 'Loratadina', principios_activos: ['loratadina'], dosis: '10 mg' }, inventario);
    expect(r).toEqual({ tipo: 'no_tiene', agotado: loratadinaAgotada });
  });

  it('"no_tiene" cuando no hay nada parecido', () => {
    const r = clasificarResultado({ nombre_comercial: 'Ibupirac', principios_activos: ['ibuprofeno'], dosis: '400 mg' }, inventario);
    expect(r).toEqual({ tipo: 'no_tiene', agotado: null });
  });

  it('sin principio activo solo puede coincidir por nombre', () => {
    const r = clasificarResultado({ nombre_comercial: 'Desconocido', principios_activos: [], dosis: null }, inventario);
    expect(r).toEqual({ tipo: 'no_tiene', agotado: null });
  });

  it('un nombre vacío no coincide con nada por nombre', () => {
    const sinNombre = med({ id: 'x', nombre_comercial: '', cantidad_envases: 3 });
    const r = clasificarResultado({ nombre_comercial: '', principios_activos: [], dosis: null }, [sinNombre]);
    expect(r.tipo).toBe('no_tiene');
  });
});
```

- [ ] **Step 2: Ejecutar las pruebas para verificar que fallan**

Run (en `mobile/`): `npx jest src/dominio`
Expected: FAIL con `Cannot find module '../dosis'` y `'../clasificar'`.

- [ ] **Step 3: Implementar**

Create `mobile/src/dominio/dosis.ts`:
```ts
import { normalizar } from './normalizar';

const UNIDADES: Record<string, { base: string; factor: number }> = {
  mcg: { base: 'mg', factor: 0.001 },
  ug: { base: 'mg', factor: 0.001 },
  'µg': { base: 'mg', factor: 0.001 },
  mg: { base: 'mg', factor: 1 },
  g: { base: 'mg', factor: 1000 },
  ml: { base: 'ml', factor: 1 },
  l: { base: 'ml', factor: 1000 },
  ui: { base: 'ui', factor: 1 },
  '%': { base: '%', factor: 1 },
};

export interface DosisParseada {
  valor: number;
  unidad: string;
}

export function parsearDosis(texto: string | null): DosisParseada | null {
  const t = normalizar(texto).replace(',', '.');
  const m = t.match(/^(\d+(?:\.\d+)?)\s*(mcg|ug|µg|mg|g|ml|l|ui|%)$/);
  if (!m) return null;
  const unidad = UNIDADES[m[2]];
  return { valor: Math.round(parseFloat(m[1]) * unidad.factor * 1000) / 1000, unidad: unidad.base };
}

/** Misma dosis tras convertir unidades. Si a una le falta la dosis, se consideran compatibles. */
export function mismaDosis(a: string | null, b: string | null): boolean {
  const na = normalizar(a);
  const nb = normalizar(b);
  if (na === '' || nb === '') return true;
  const pa = parsearDosis(a);
  const pb = parsearDosis(b);
  if (pa && pb) return pa.valor === pb.valor && pa.unidad === pb.unidad;
  return na === nb;
}
```

Create `mobile/src/dominio/principios.ts`:
```ts
import { normalizar } from './normalizar';

function conjunto(lista: string[]): Set<string> {
  return new Set(lista.map(normalizar).filter((p) => p !== ''));
}

/** Mismo conjunto de principios activos (sin importar orden, mayúsculas ni tildes). */
export function mismosPrincipios(a: string[], b: string[]): boolean {
  const sa = conjunto(a);
  const sb = conjunto(b);
  if (sa.size === 0 || sb.size === 0 || sa.size !== sb.size) return false;
  for (const p of sa) if (!sb.has(p)) return false;
  return true;
}
```

Create `mobile/src/dominio/clasificar.ts`:
```ts
import { mismaDosis } from './dosis';
import { normalizar } from './normalizar';
import { mismosPrincipios } from './principios';
import type { DatosMedicamento, Medicamento, ResultadoBusqueda } from './tipos';

export function clasificarResultado(
  buscado: Pick<DatosMedicamento, 'nombre_comercial' | 'principios_activos' | 'dosis'>,
  inventario: Medicamento[],
): ResultadoBusqueda {
  const nombre = normalizar(buscado.nombre_comercial);
  const mismoProducto = nombre === ''
    ? []
    : inventario.filter((m) => normalizar(m.nombre_comercial) === nombre && mismaDosis(m.dosis, buscado.dosis));

  const conStock = mismoProducto.find((m) => m.cantidad_envases > 0);
  if (conStock) return { tipo: 'tiene', medicamento: conStock };

  const coincidencias = inventario
    .filter((m) => m.cantidad_envases > 0 && mismosPrincipios(m.principios_activos, buscado.principios_activos))
    .map((m) => ({ medicamento: m, dosisDistinta: !mismaDosis(m.dosis, buscado.dosis) }))
    .sort((x, y) => Number(x.dosisDistinta) - Number(y.dosisDistinta));
  if (coincidencias.length > 0) return { tipo: 'equivalente', coincidencias };

  return { tipo: 'no_tiene', agotado: mismoProducto[0] ?? null };
}
```

- [ ] **Step 4: Ejecutar las pruebas para verificar que pasan**

Run (en `mobile/`): `npx jest src/dominio && npm run typecheck`
Expected: todas las pruebas de `src/dominio` en verde y `tsc` sin errores.

- [ ] **Step 5: Commit**

```bash
cd /home/jonathan/Documents/Projects/FarmaSnap
git add mobile/src/dominio
git commit -m "feat(dominio): dosis, principios activos y clasificación de la búsqueda por foto"
```

---

### Task 7: Dominio — búsqueda por texto, duplicados y formato

**Files:**
- Create: `mobile/src/dominio/buscar.ts`, `mobile/src/dominio/formato.ts`
- Test: `mobile/src/dominio/__tests__/buscar.test.ts`, `mobile/src/dominio/__tests__/formato.test.ts`

**Interfaces:**
- Consumes: `normalizar`, `Medicamento`, `DatosMedicamento`, `ValoresFormulario`, `Extraccion` (Task 5).
- Produces:
  - `ordenarInventario(lista: Medicamento[]): Medicamento[]` (con stock primero, luego por nombre)
  - `buscarPorTexto(consulta: string, inventario: Medicamento[]): Medicamento[]`
  - `buscarDuplicado(datos: Pick<DatosMedicamento, 'nombre_comercial' | 'dosis'>, inventario: Medicamento[], excluirId?: string): Medicamento | undefined`
  - `textoCantidad(n: number): string`, `parsearPrincipios(texto: string): string[]`, `textoOpcional(texto: string): string | null`, `valoresDesdeExtraccion(e: Extraccion): ValoresFormulario`

- [ ] **Step 1: Escribir las pruebas (fallan)**

Create `mobile/src/dominio/__tests__/buscar.test.ts`:
```ts
import { buscarDuplicado, buscarPorTexto, ordenarInventario } from '../buscar';
import type { Medicamento } from '../tipos';

function med(id: string, nombre: string, principios: string[], cantidad = 1, dosis: string | null = null): Medicamento {
  return {
    id, nombre_comercial: nombre, principios_activos: principios, dosis, forma: null, laboratorio: null,
    cantidad_envases: cantidad, foto_path: null, creado_en: '', actualizado_en: '', actualizado_por_email: null,
  };
}

const kitadol = med('1', 'Kitadol', ['paracetamol'], 2, '500 mg');
const ibupirac = med('2', 'Ibupirac', ['ibuprofeno'], 1, '400 mg');
const loratadina = med('3', 'Loratadina', ['loratadina'], 0, '10 mg');
const tapsin = med('4', 'Tapsin Día', ['paracetamol', 'fenilefrina'], 1);
const inventario = [loratadina, tapsin, ibupirac, kitadol];

describe('buscarPorTexto', () => {
  it('sin consulta devuelve todo, con stock primero y por nombre', () => {
    expect(buscarPorTexto('', inventario).map((m) => m.id)).toEqual(['2', '1', '4', '3']);
  });

  it('busca por nombre comercial y por principio activo', () => {
    expect(buscarPorTexto('kitadol', inventario).map((m) => m.id)).toEqual(['1']);
    expect(buscarPorTexto('paracetamol', inventario).map((m) => m.id)).toEqual(['1', '4']);
  });

  it('ignora tildes y mayúsculas y acepta prefijos', () => {
    expect(buscarPorTexto('TAPSIN dia', inventario).map((m) => m.id)).toEqual(['4']);
    expect(buscarPorTexto('ibu', inventario).map((m) => m.id)).toEqual(['2']);
  });

  it('tolera un error de tipeo en palabras de 5 letras o más', () => {
    expect(buscarPorTexto('ibuprofemo', inventario).map((m) => m.id)).toEqual(['2']);
    expect(buscarPorTexto('kitadl', inventario).map((m) => m.id)).toEqual(['1']);
  });

  it('no tolera errores en palabras cortas', () => {
    expect(buscarPorTexto('kxt', inventario)).toEqual([]);
  });

  it('exige que coincidan todas las palabras', () => {
    expect(buscarPorTexto('paracetamol fenilefrina', inventario).map((m) => m.id)).toEqual(['4']);
  });

  it('incluye los "Sin stock" al final', () => {
    expect(buscarPorTexto('lorat', inventario).map((m) => m.id)).toEqual(['3']);
  });
});

describe('ordenarInventario', () => {
  it('no modifica la lista original', () => {
    const copia = [...inventario];
    ordenarInventario(inventario);
    expect(inventario).toEqual(copia);
  });
});

describe('buscarDuplicado', () => {
  it('encuentra el mismo nombre y dosis aunque cambien mayúsculas, tildes y espacios', () => {
    expect(buscarDuplicado({ nombre_comercial: ' KITÁDOL ', dosis: '500  MG' }, inventario)).toBe(kitadol);
  });

  it('otra dosis no es duplicado', () => {
    expect(buscarDuplicado({ nombre_comercial: 'Kitadol', dosis: '1 g' }, inventario)).toBeUndefined();
  });

  it('dosis vacía solo coincide con dosis vacía', () => {
    expect(buscarDuplicado({ nombre_comercial: 'Tapsin día', dosis: null }, inventario)).toBe(tapsin);
    expect(buscarDuplicado({ nombre_comercial: 'Kitadol', dosis: null }, inventario)).toBeUndefined();
  });

  it('puede excluir el propio medicamento al editar', () => {
    expect(buscarDuplicado({ nombre_comercial: 'Kitadol', dosis: '500 mg' }, inventario, '1')).toBeUndefined();
  });
});
```

Create `mobile/src/dominio/__tests__/formato.test.ts`:
```ts
import { parsearPrincipios, textoCantidad, textoOpcional, valoresDesdeExtraccion } from '../formato';

describe('formato', () => {
  it('textoCantidad', () => {
    expect(textoCantidad(0)).toBe('Sin stock');
    expect(textoCantidad(1)).toBe('1 envase');
    expect(textoCantidad(3)).toBe('3 envases');
  });

  it('parsearPrincipios separa por coma, punto y coma o +, y limpia', () => {
    expect(parsearPrincipios('Paracetamol, Cafeína + paracetamol;  ')).toEqual(['paracetamol', 'cafeína']);
    expect(parsearPrincipios('   ')).toEqual([]);
  });

  it('textoOpcional', () => {
    expect(textoOpcional('  500  mg ')).toBe('500 mg');
    expect(textoOpcional('   ')).toBeNull();
  });

  it('valoresDesdeExtraccion arma el formulario con 1 envase', () => {
    expect(valoresDesdeExtraccion({
      legible: true, es_medicamento: true, nombre_comercial: null,
      principios_activos: ['ibuprofeno'], dosis: '400 mg', forma: null, laboratorio: null,
    })).toEqual({
      nombre_comercial: '', principios_activos: ['ibuprofeno'], dosis: '400 mg',
      forma: null, laboratorio: null, cantidad_envases: 1,
    });
  });
});
```

- [ ] **Step 2: Ejecutar las pruebas para verificar que fallan**

Run (en `mobile/`): `npx jest src/dominio`
Expected: FAIL con `Cannot find module '../buscar'` y `'../formato'`.

- [ ] **Step 3: Implementar**

Create `mobile/src/dominio/buscar.ts`:
```ts
import { normalizar } from './normalizar';
import type { DatosMedicamento, Medicamento } from './tipos';

function distancia(a: string, b: string): number {
  const fila = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = fila[0];
    fila[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const arriba = fila[j];
      fila[j] = Math.min(fila[j] + 1, fila[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = arriba;
    }
  }
  return fila[b.length];
}

function palabraCoincide(token: string, palabra: string): boolean {
  if (palabra.includes(token)) return true;
  if (token.length < 5) return false;
  // Compara con el inicio de la palabra del mismo largo (admite escribir solo el comienzo).
  return distancia(token, palabra.slice(0, token.length)) <= 1 || distancia(token, palabra) <= 1;
}

export function ordenarInventario(lista: Medicamento[]): Medicamento[] {
  return [...lista].sort(
    (a, b) =>
      Number(b.cantidad_envases > 0) - Number(a.cantidad_envases > 0) ||
      normalizar(a.nombre_comercial).localeCompare(normalizar(b.nombre_comercial)),
  );
}

export function buscarPorTexto(consulta: string, inventario: Medicamento[]): Medicamento[] {
  const tokens = normalizar(consulta).split(' ').filter(Boolean);
  if (tokens.length === 0) return ordenarInventario(inventario);
  const resultado = inventario.filter((m) => {
    const palabras = normalizar([m.nombre_comercial, ...m.principios_activos].join(' ')).split(' ');
    return tokens.every((t) => palabras.some((p) => palabraCoincide(t, p)));
  });
  return ordenarInventario(resultado);
}

/** Misma regla que el índice único de la base de datos. */
export function buscarDuplicado(
  datos: Pick<DatosMedicamento, 'nombre_comercial' | 'dosis'>,
  inventario: Medicamento[],
  excluirId?: string,
): Medicamento | undefined {
  const nombre = normalizar(datos.nombre_comercial);
  const dosis = normalizar(datos.dosis);
  return inventario.find(
    (m) => m.id !== excluirId && normalizar(m.nombre_comercial) === nombre && normalizar(m.dosis) === dosis,
  );
}
```

Create `mobile/src/dominio/formato.ts`:
```ts
import type { Extraccion, ValoresFormulario } from './tipos';

export function textoCantidad(n: number): string {
  if (n === 0) return 'Sin stock';
  return n === 1 ? '1 envase' : `${n} envases`;
}

export function textoOpcional(texto: string): string | null {
  const t = texto.replace(/\s+/g, ' ').trim();
  return t === '' ? null : t;
}

export function parsearPrincipios(texto: string): string[] {
  return [
    ...new Set(
      texto
        .split(/[,;+]/)
        .map((p) => p.replace(/\s+/g, ' ').trim().toLowerCase())
        .filter((p) => p !== ''),
    ),
  ];
}

export function valoresDesdeExtraccion(e: Extraccion): ValoresFormulario {
  return {
    nombre_comercial: e.nombre_comercial ?? '',
    principios_activos: e.principios_activos,
    dosis: e.dosis,
    forma: e.forma,
    laboratorio: e.laboratorio,
    cantidad_envases: 1,
  };
}
```

- [ ] **Step 4: Ejecutar las pruebas para verificar que pasan**

Run (en `mobile/`): `npx jest src/dominio && npm run typecheck`
Expected: todas las pruebas de `src/dominio` en verde y `tsc` sin errores.

- [ ] **Step 5: Commit**

```bash
cd /home/jonathan/Documents/Projects/FarmaSnap
git add mobile/src/dominio
git commit -m "feat(dominio): búsqueda tolerante a errores, duplicados y formato"
```

---

### Task 8: App — conexión a Supabase, sesión, inicio de sesión y navegación

**Files:**
- Create: `mobile/src/datos/supabase.ts`, `mobile/src/datos/sesion.ts`, `mobile/src/ui/tema.ts`, `mobile/src/ui/Boton.tsx`, `mobile/src/ui/confirmar.ts`, `mobile/app/login.tsx`, `mobile/.env` (no se versiona)
- Modify (reemplazar): `mobile/app/_layout.tsx`, `mobile/app/index.tsx` (provisional)

**Interfaces:**
- Produces:
  - `supabase` (cliente con sesión persistente en AsyncStorage)
  - `useSesion(): { sesion: Session | null; cargando: boolean }`
  - `colores` (paleta de las maquetas)
  - `<Boton titulo onPress variante? deshabilitado? cargando? />` con `variante: 'primario' | 'secundario' | 'peligro'`
  - `confirmar(titulo: string, mensaje: string, textoAceptar?: string): Promise<boolean>`

- [ ] **Step 1: Crear `mobile/.env`**

Pedir a la persona usuaria la **Project URL** y la clave **anon / publishable** de la Tarea 0 (son públicas: la seguridad la da RLS) y crear `mobile/.env` con el formato de `.env.example`. Verificar que no se versiona: `git check-ignore mobile/.env` debe imprimir la ruta.

- [ ] **Step 2: Cliente de Supabase y sesión**

Create `mobile/src/datos/supabase.ts`:
```ts
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const clave = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !clave) {
  throw new Error('Faltan EXPO_PUBLIC_SUPABASE_URL o EXPO_PUBLIC_SUPABASE_ANON_KEY en mobile/.env');
}

export const supabase = createClient(url, clave, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Renueva el token solo con la app en primer plano (recomendación de Supabase para RN).
AppState.addEventListener('change', (estado) => {
  if (estado === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
```

Create `mobile/src/datos/sesion.ts`:
```ts
import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export function useSesion(): { sesion: Session | null; cargando: boolean } {
  const [sesion, setSesion] = useState<Session | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSesion(data.session);
      setCargando(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_evento, nueva) => setSesion(nueva));
    return () => data.subscription.unsubscribe();
  }, []);

  return { sesion, cargando };
}
```

- [ ] **Step 3: Tema, botón y confirmación**

Create `mobile/src/ui/tema.ts`:
```ts
export const colores = {
  fondo: '#f7faf9',
  tinta: '#14302b',
  suave: '#6b807b',
  linea: '#dfe7e5',
  marca: '#0f8a75',
  marcaOscuro: '#0b6b5b',
  marcaClaro: '#e3f4f0',
  ok: '#1f9d55',
  okClaro: '#e5f6ec',
  eq: '#c27c0e',
  eqClaro: '#fdf3e1',
  no: '#c0392b',
  noClaro: '#fbeaea',
  blanco: '#ffffff',
} as const;
```

Create `mobile/src/ui/Boton.tsx`:
```tsx
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colores } from './tema';

interface Props {
  titulo: string;
  onPress: () => void;
  variante?: 'primario' | 'secundario' | 'peligro';
  deshabilitado?: boolean;
  cargando?: boolean;
}

export function Boton({ titulo, onPress, variante = 'primario', deshabilitado, cargando }: Props) {
  const inactivo = deshabilitado || cargando;
  const colorTexto = variante === 'primario' ? colores.blanco : variante === 'peligro' ? colores.no : colores.marcaOscuro;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={inactivo}
      style={({ pressed }) => [estilos.base, estilos[variante], inactivo && estilos.inactivo, pressed && estilos.presionado]}
    >
      {cargando ? (
        <ActivityIndicator color={colorTexto} />
      ) : (
        <Text style={[estilos.texto, { color: colorTexto }]}>{titulo}</Text>
      )}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  base: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14, alignItems: 'center', marginTop: 8 },
  primario: { backgroundColor: colores.marca },
  secundario: { borderWidth: 1.5, borderColor: colores.marca },
  peligro: {},
  inactivo: { opacity: 0.5 },
  presionado: { opacity: 0.8 },
  texto: { fontWeight: '600', fontSize: 15 },
});
```

Create `mobile/src/ui/confirmar.ts`:
```ts
import { Alert } from 'react-native';

export function confirmar(titulo: string, mensaje: string, textoAceptar = 'Aceptar'): Promise<boolean> {
  return new Promise((resolver) => {
    Alert.alert(
      titulo,
      mensaje,
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => resolver(false) },
        { text: textoAceptar, style: 'destructive', onPress: () => resolver(true) },
      ],
      { cancelable: true, onDismiss: () => resolver(false) },
    );
  });
}
```

- [ ] **Step 4: Pantalla de inicio de sesión**

Create `mobile/app/login.tsx`:
```tsx
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../src/datos/supabase';
import { Boton } from '../src/ui/Boton';
import { colores } from '../src/ui/tema';

export default function Login() {
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ingresar() {
    setEnviando(true);
    setError(null);
    const { error: fallo } = await supabase.auth.signInWithPassword({ email: correo.trim(), password: clave });
    setEnviando(false);
    if (fallo) {
      setError(
        fallo.message.toLowerCase().includes('invalid')
          ? 'Correo o contraseña incorrectos.'
          : 'No se pudo iniciar sesión. Revisa tu conexión.',
      );
    }
    // Si funciona, el layout cambia solo a la pantalla de inventario (onAuthStateChange).
  }

  return (
    <KeyboardAvoidingView style={estilos.pantalla} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={estilos.logo}><Text style={estilos.logoTexto}>+</Text></View>
      <Text style={estilos.titulo}>FarmaSnap</Text>
      <Text style={estilos.lema}>El botiquín de la casa, en tu bolsillo</Text>

      <Text style={estilos.etiqueta}>CORREO</Text>
      <TextInput style={estilos.campo} value={correo} onChangeText={setCorreo} autoCapitalize="none"
        autoComplete="email" keyboardType="email-address" placeholder="nombre@correo.cl" />
      <Text style={estilos.etiqueta}>CONTRASEÑA</Text>
      <TextInput style={estilos.campo} value={clave} onChangeText={setClave} secureTextEntry
        autoComplete="password" placeholder="••••••••" />

      {error && <Text style={estilos.error}>{error}</Text>}
      <Boton titulo="Ingresar" onPress={ingresar} cargando={enviando} deshabilitado={!correo.trim() || !clave} />
      <Text style={estilos.nota}>Solo una vez por teléfono. Las cuentas las crea el administrador.</Text>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, justifyContent: 'center', padding: 28, backgroundColor: colores.fondo },
  logo: { width: 72, height: 72, borderRadius: 22, backgroundColor: colores.marca, alignSelf: 'center',
    alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  logoTexto: { color: colores.blanco, fontSize: 40, fontWeight: '700' },
  titulo: { fontSize: 26, fontWeight: '700', textAlign: 'center', color: colores.tinta },
  lema: { textAlign: 'center', color: colores.suave, marginBottom: 24 },
  etiqueta: { fontSize: 11, fontWeight: '600', color: colores.suave, marginTop: 10 },
  campo: { backgroundColor: colores.blanco, borderWidth: 1, borderColor: colores.linea, borderRadius: 11,
    padding: 12, marginTop: 4, fontSize: 15 },
  error: { color: colores.no, marginTop: 12 },
  nota: { textAlign: 'center', color: colores.suave, fontSize: 12, marginTop: 14 },
});
```

- [ ] **Step 5: Layout con rutas protegidas e inventario provisional**

Replace `mobile/app/_layout.tsx`:
```tsx
import { Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useSesion } from '../src/datos/sesion';
import { colores } from '../src/ui/tema';

export default function RootLayout() {
  const { sesion, cargando } = useSesion();

  if (cargando) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colores.fondo }}>
        <ActivityIndicator color={colores.marca} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerTintColor: colores.marcaOscuro, contentStyle: { backgroundColor: colores.fondo } }}>
      <Stack.Protected guard={!!sesion}>
        <Stack.Screen name="index" options={{ title: 'Botiquín de casa' }} />
      </Stack.Protected>
      <Stack.Protected guard={!sesion}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}
```

Replace `mobile/app/index.tsx` (provisional; la Tarea 10 la reemplaza):
```tsx
import { Text, View } from 'react-native';
import { supabase } from '../src/datos/supabase';
import { Boton } from '../src/ui/Boton';

export default function Inventario() {
  return (
    <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
      <Text style={{ textAlign: 'center', marginBottom: 12 }}>Sesión iniciada ✔</Text>
      <Boton titulo="Cerrar sesión" variante="secundario" onPress={() => supabase.auth.signOut()} />
    </View>
  );
}
```

- [ ] **Step 6: Verificar**

Run (en `mobile/`): `npm run typecheck && npx jest`
Expected: sin errores de tipos y todas las pruebas en verde.

Verificación manual (con la persona usuaria): `npx expo start`, escanear el QR con Expo Go.
1. Aparece la pantalla de inicio de sesión.
2. Con una contraseña incorrecta aparece "Correo o contraseña incorrectos."
3. Con la cuenta creada en la Tarea 0 aparece "Sesión iniciada ✔".
4. Al cerrar Expo Go por completo y reabrir el proyecto, sigue con la sesión iniciada.
5. "Cerrar sesión" vuelve a la pantalla de inicio de sesión.

Nota: `Stack.Protected` requiere Expo Router de SDK 53 o superior. Si el SDK instalado no lo trae, `typecheck` fallará; en ese caso, usar una redirección con `<Redirect href="/login" />` en `index.tsx` cuando no hay sesión, y `<Redirect href="/" />` en `login.tsx` cuando sí la hay.

- [ ] **Step 7: Commit**

```bash
cd /home/jonathan/Documents/Projects/FarmaSnap
git add mobile/src/datos/supabase.ts mobile/src/datos/sesion.ts mobile/src/ui mobile/app
git commit -m "feat(app): conexión a Supabase, sesión persistente e inicio de sesión"
```

---

### Task 9: App — utilidades de datos (errores, imagen, caché, captura temporal, análisis)

**Files:**
- Create: `mobile/src/datos/erroresFunciones.ts`, `mobile/src/datos/dimensiones.ts`, `mobile/src/datos/imagen.ts`, `mobile/src/datos/cache.ts`, `mobile/src/datos/capturaTemporal.ts`, `mobile/src/datos/analizarFoto.ts`
- Test: `mobile/src/datos/__tests__/erroresFunciones.test.ts`, `mobile/src/datos/__tests__/dimensiones.test.ts`, `mobile/src/datos/__tests__/cache.test.ts`

**Interfaces:**
- Consumes: `supabase` (Task 8), `Medicamento`, `Extraccion` (Task 5), contrato HTTP de `analizar-foto` (Task 4).
- Produces:
  - `type CodigoErrorAnalisis = 'sin_conexion' | 'limite_diario' | 'no_autorizado' | 'ia_no_disponible'`; `class ErrorAnalisisFoto { codigo }`; `codigoDesdeError(error: unknown): CodigoErrorAnalisis`; `mensajeErrorAnalisis(error: unknown): string`
  - `dimensionesDestino(ancho: number, alto: number, maximo?: number): { width: number } | { height: number }`
  - `interface FotoPreparada { uri: string; base64: string }`; `prepararFoto(uri: string, ancho: number, alto: number): Promise<FotoPreparada>`
  - `guardarCache(medicamentos: Medicamento[], ahora?: Date): Promise<void>`; `leerCache(): Promise<{ guardadoEn: string; medicamentos: Medicamento[] } | null>`; `haceCuanto(desdeIso: string, ahora?: Date): string`
  - `guardarCapturaPendiente(c: { datos: Extraccion; foto: FotoPreparada | null }): void`; `leerCapturaPendiente()`; `limpiarCapturaPendiente(): void`
  - `analizarFoto(imagenBase64: string, limiteMs?: number): Promise<Extraccion>` (lanza errores que entiende `codigoDesdeError`)

- [ ] **Step 1: Escribir las pruebas (fallan)**

Create `mobile/src/datos/__tests__/erroresFunciones.test.ts`:
```ts
import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';
import { codigoDesdeError, ErrorAnalisisFoto, mensajeErrorAnalisis } from '../erroresFunciones';

describe('codigoDesdeError', () => {
  it('traduce los estados HTTP de la Edge Function', () => {
    expect(codigoDesdeError(new FunctionsHttpError({ status: 429 }))).toBe('limite_diario');
    expect(codigoDesdeError(new FunctionsHttpError({ status: 401 }))).toBe('no_autorizado');
    expect(codigoDesdeError(new FunctionsHttpError({ status: 502 }))).toBe('ia_no_disponible');
  });

  it('un fallo de red es "sin_conexion"', () => {
    expect(codigoDesdeError(new FunctionsFetchError(new Error('Network request failed')))).toBe('sin_conexion');
  });

  it('respeta los errores propios y trata lo desconocido como IA no disponible', () => {
    expect(codigoDesdeError(new ErrorAnalisisFoto('limite_diario'))).toBe('limite_diario');
    expect(codigoDesdeError(new Error('raro'))).toBe('ia_no_disponible');
    expect(codigoDesdeError(undefined)).toBe('ia_no_disponible');
  });

  it('da un mensaje en español para cada caso', () => {
    expect(mensajeErrorAnalisis(new FunctionsHttpError({ status: 429 }))).toMatch(/límite diario/);
    expect(mensajeErrorAnalisis(new FunctionsFetchError(null))).toMatch(/Sin conexión/);
  });
});
```

Create `mobile/src/datos/__tests__/dimensiones.test.ts`:
```ts
import { dimensionesDestino } from '../dimensiones';

describe('dimensionesDestino', () => {
  it('limita el lado mayor a 1000 px', () => {
    expect(dimensionesDestino(3000, 4000)).toEqual({ height: 1000 });
    expect(dimensionesDestino(4000, 3000)).toEqual({ width: 1000 });
  });

  it('no agranda fotos pequeñas', () => {
    expect(dimensionesDestino(800, 600)).toEqual({ width: 800 });
  });
});
```

Create `mobile/src/datos/__tests__/cache.test.ts`:
```ts
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Medicamento } from '../../dominio/tipos';
import { guardarCache, haceCuanto, leerCache } from '../cache';

const kitadol: Medicamento = {
  id: '1', nombre_comercial: 'Kitadol', principios_activos: ['paracetamol'], dosis: '500 mg', forma: null,
  laboratorio: null, cantidad_envases: 2, foto_path: null, creado_en: '', actualizado_en: '', actualizado_por_email: null,
};

beforeEach(() => AsyncStorage.clear());

describe('caché del inventario', () => {
  it('guarda y lee la lista con su fecha', async () => {
    await guardarCache([kitadol], new Date('2026-10-18T10:00:00Z'));
    expect(await leerCache()).toEqual({ guardadoEn: '2026-10-18T10:00:00.000Z', medicamentos: [kitadol] });
  });

  it('sin caché devuelve null', async () => {
    expect(await leerCache()).toBeNull();
  });

  it('una caché corrupta devuelve null sin lanzar', async () => {
    await AsyncStorage.setItem('farmasnap:inventario:v1', '{no es json');
    expect(await leerCache()).toBeNull();
    await AsyncStorage.setItem('farmasnap:inventario:v1', JSON.stringify({ medicamentos: 'x' }));
    expect(await leerCache()).toBeNull();
  });
});

describe('haceCuanto', () => {
  const ahora = new Date('2026-10-18T12:00:00Z');
  it('describe el tiempo transcurrido', () => {
    expect(haceCuanto('2026-10-18T11:59:40Z', ahora)).toBe('hace un momento');
    expect(haceCuanto('2026-10-18T11:45:00Z', ahora)).toBe('hace 15 min');
    expect(haceCuanto('2026-10-18T09:00:00Z', ahora)).toBe('hace 3 h');
    expect(haceCuanto('2026-10-16T12:00:00Z', ahora)).toBe('hace 2 días');
  });
});
```

- [ ] **Step 2: Ejecutar las pruebas para verificar que fallan**

Run (en `mobile/`): `npx jest src/datos`
Expected: FAIL con `Cannot find module '../erroresFunciones'`, `'../dimensiones'` y `'../cache'`.

- [ ] **Step 3: Implementar**

Create `mobile/src/datos/erroresFunciones.ts`:
```ts
import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';

export type CodigoErrorAnalisis = 'sin_conexion' | 'limite_diario' | 'no_autorizado' | 'ia_no_disponible';

export class ErrorAnalisisFoto extends Error {
  constructor(public readonly codigo: CodigoErrorAnalisis) {
    super(codigo);
    this.name = 'ErrorAnalisisFoto';
  }
}

export function codigoDesdeError(error: unknown): CodigoErrorAnalisis {
  if (error instanceof ErrorAnalisisFoto) return error.codigo;
  if (error instanceof FunctionsFetchError) return 'sin_conexion';
  if (error instanceof FunctionsHttpError) {
    const estado = (error.context as { status?: number } | undefined)?.status;
    if (estado === 429) return 'limite_diario';
    if (estado === 401) return 'no_autorizado';
  }
  return 'ia_no_disponible';
}

const MENSAJES: Record<CodigoErrorAnalisis, string> = {
  sin_conexion: 'Sin conexión. Puedes buscar o registrar escribiendo cuando vuelva internet.',
  limite_diario: 'Se alcanzó el límite diario de fotos. Puedes escribir los datos a mano.',
  no_autorizado: 'Tu sesión expiró. Cierra sesión y vuelve a entrar.',
  ia_no_disponible: 'No pude leer la caja ahora. Puedes reintentar o escribir los datos a mano.',
};

export function mensajeErrorAnalisis(error: unknown): string {
  return MENSAJES[codigoDesdeError(error)];
}
```

Create `mobile/src/datos/dimensiones.ts`:
```ts
/** Redimensiona para que el lado mayor no supere `maximo`, sin agrandar. */
export function dimensionesDestino(ancho: number, alto: number, maximo = 1000): { width: number } | { height: number } {
  return alto > ancho ? { height: Math.min(alto, maximo) } : { width: Math.min(ancho, maximo) };
}
```

Create `mobile/src/datos/imagen.ts`:
```ts
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { dimensionesDestino } from './dimensiones';

export interface FotoPreparada {
  uri: string;
  base64: string;
}

export async function prepararFoto(uri: string, ancho: number, alto: number): Promise<FotoPreparada> {
  const resultado = await manipulateAsync(uri, [{ resize: dimensionesDestino(ancho, alto) }], {
    compress: 0.7,
    format: SaveFormat.JPEG,
    base64: true,
  });
  if (!resultado.base64) throw new Error('No se pudo procesar la foto');
  return { uri: resultado.uri, base64: resultado.base64 };
}
```
(Si `manipulateAsync` aparece como obsoleto en el SDK instalado, sigue funcionando; la API nueva equivalente es `ImageManipulator.manipulate(uri).resize(...).renderAsync()` y luego `saveAsync({ compress: 0.7, format: SaveFormat.JPEG, base64: true })`.)

Create `mobile/src/datos/cache.ts`:
```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Medicamento } from '../dominio/tipos';

const CLAVE = 'farmasnap:inventario:v1';

export interface CacheInventario {
  guardadoEn: string;
  medicamentos: Medicamento[];
}

export async function guardarCache(medicamentos: Medicamento[], ahora = new Date()): Promise<void> {
  try {
    const valor: CacheInventario = { guardadoEn: ahora.toISOString(), medicamentos };
    await AsyncStorage.setItem(CLAVE, JSON.stringify(valor));
  } catch {
    // La caché es una comodidad: si falla, la app sigue funcionando en línea.
  }
}

export async function leerCache(): Promise<CacheInventario | null> {
  try {
    const texto = await AsyncStorage.getItem(CLAVE);
    if (!texto) return null;
    const valor = JSON.parse(texto) as Partial<CacheInventario>;
    if (typeof valor.guardadoEn !== 'string' || !Array.isArray(valor.medicamentos)) return null;
    return { guardadoEn: valor.guardadoEn, medicamentos: valor.medicamentos };
  } catch {
    return null;
  }
}

export function haceCuanto(desdeIso: string, ahora = new Date()): string {
  const minutos = Math.floor((ahora.getTime() - new Date(desdeIso).getTime()) / 60_000);
  if (minutos < 1) return 'hace un momento';
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? 'hace 1 día' : `hace ${dias} días`;
}
```

Create `mobile/src/datos/capturaTemporal.ts`:
```ts
import type { Extraccion } from '../dominio/tipos';
import type { FotoPreparada } from './imagen';

/** Pasa la foto y los datos de "Buscar por foto" a "Registrar" sin volver a sacar la foto. */
export interface CapturaPendiente {
  datos: Extraccion;
  foto: FotoPreparada | null;
}

let pendiente: CapturaPendiente | null = null;

export function guardarCapturaPendiente(captura: CapturaPendiente): void {
  pendiente = captura;
}

export function leerCapturaPendiente(): CapturaPendiente | null {
  return pendiente;
}

export function limpiarCapturaPendiente(): void {
  pendiente = null;
}
```

Create `mobile/src/datos/analizarFoto.ts`:
```ts
import type { Extraccion } from '../dominio/tipos';
import { ErrorAnalisisFoto } from './erroresFunciones';
import { supabase } from './supabase';

export async function analizarFoto(imagenBase64: string, limiteMs = 45_000): Promise<Extraccion> {
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<never>((_, rechazar) => {
    temporizador = setTimeout(() => rechazar(new ErrorAnalisisFoto('ia_no_disponible')), limiteMs);
  });
  try {
    const { data, error } = await Promise.race([
      supabase.functions.invoke<Extraccion>('analizar-foto', { body: { imagen_base64: imagenBase64 } }),
      limite,
    ]);
    if (error) throw error;
    if (!data) throw new ErrorAnalisisFoto('ia_no_disponible');
    return data;
  } finally {
    clearTimeout(temporizador);
  }
}
```

- [ ] **Step 4: Ejecutar las pruebas para verificar que pasan**

Run (en `mobile/`): `npx jest && npm run typecheck`
Expected: todas las pruebas en verde y `tsc` sin errores.

- [ ] **Step 5: Commit**

```bash
cd /home/jonathan/Documents/Projects/FarmaSnap
git add mobile/src/datos
git commit -m "feat(datos): errores de IA, preparación de fotos, caché sin conexión y llamada a analizar-foto"
```

---

### Task 10: App — repositorio, estado compartido y pantalla de inventario

**Files:**
- Create: `mobile/src/datos/medicamentos.ts`, `mobile/src/datos/InventarioContext.tsx`, `mobile/src/ui/MedicamentoItem.tsx`, `mobile/src/ui/AvisoConexion.tsx`, pantallas provisionales `mobile/app/registrar.tsx`, `mobile/app/buscar-foto.tsx`, `mobile/app/medicamento/[id].tsx`
- Modify (reemplazar): `mobile/app/_layout.tsx`, `mobile/app/index.tsx`

**Interfaces:**
- Consumes: `supabase`, `useSesion` (Task 8); `guardarCache`, `leerCache`, `haceCuanto` (Task 9); `buscarPorTexto`, `textoCantidad` (Task 7); `colores`, `Boton`, `confirmar` (Task 8).
- Produces:
  - `listarMedicamentos(): Promise<Medicamento[]>`
  - `class ErrorDuplicado extends Error`
  - `crearMedicamento(v: ValoresFormulario & { foto_path: string | null }): Promise<Medicamento>` (lanza `ErrorDuplicado` ante `23505`)
  - `actualizarMedicamento(id: string, datos: DatosMedicamento): Promise<Medicamento>` (lanza `ErrorDuplicado`)
  - `ajustarEnvases(id: string, delta: number): Promise<Medicamento>`
  - `eliminarMedicamento(m: Medicamento): Promise<void>`
  - `subirFoto(base64: string): Promise<string>`; `eliminarFoto(path: string): Promise<void>`
  - `urlsFirmadas(paths: string[]): Promise<Record<string, string>>`
  - `InventarioProvider({ activo, children })`; `useInventario(): { medicamentos; fotos: Record<string,string>; cargando; sinConexion; actualizadoEn: string | null; recargar(): Promise<Medicamento[]>; ajustar(id, delta): Promise<void> }`
  - Rutas declaradas en el layout: `index`, `registrar`, `buscar-foto`, `medicamento/[id]`, `login`

- [ ] **Step 1: Repositorio de medicamentos**

Create `mobile/src/datos/medicamentos.ts`:
```ts
import { decode } from 'base64-arraybuffer';
import type { DatosMedicamento, Medicamento, ValoresFormulario } from '../dominio/tipos';
import { supabase } from './supabase';

const COLUMNAS =
  'id,nombre_comercial,principios_activos,dosis,forma,laboratorio,cantidad_envases,foto_path,creado_en,actualizado_en,actualizado_por_email';
const BUCKET = 'fotos';

export class ErrorDuplicado extends Error {
  constructor() {
    super('Ya existe un medicamento con ese nombre y dosis');
    this.name = 'ErrorDuplicado';
  }
}

function lanzar(error: { code?: string } | null): void {
  if (!error) return;
  if (error.code === '23505') throw new ErrorDuplicado();
  throw error;
}

export async function listarMedicamentos(): Promise<Medicamento[]> {
  const { data, error } = await supabase.from('medicamentos').select(COLUMNAS);
  lanzar(error);
  return (data ?? []) as Medicamento[];
}

export async function crearMedicamento(v: ValoresFormulario & { foto_path: string | null }): Promise<Medicamento> {
  const { data, error } = await supabase.from('medicamentos').insert(v).select(COLUMNAS).single();
  lanzar(error);
  return data as Medicamento;
}

export async function actualizarMedicamento(id: string, datos: DatosMedicamento): Promise<Medicamento> {
  const { data, error } = await supabase.from('medicamentos').update(datos).eq('id', id).select(COLUMNAS).single();
  lanzar(error);
  return data as Medicamento;
}

export async function ajustarEnvases(id: string, delta: number): Promise<Medicamento> {
  const { data, error } = await supabase.rpc('ajustar_envases', { p_id: id, p_delta: delta });
  lanzar(error);
  return data as Medicamento;
}

export async function subirFoto(base64: string): Promise<string> {
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, decode(base64), { contentType: 'image/jpeg' });
  if (error) throw error;
  return path;
}

export async function eliminarFoto(path: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([path]);
}

export async function eliminarMedicamento(m: Medicamento): Promise<void> {
  const { error } = await supabase.from('medicamentos').delete().eq('id', m.id);
  lanzar(error);
  if (m.foto_path) await eliminarFoto(m.foto_path).catch(() => undefined);
}

export async function urlsFirmadas(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 60 * 60);
  if (error || !data) return {};
  const mapa: Record<string, string> = {};
  for (const item of data) if (item.path && item.signedUrl) mapa[item.path] = item.signedUrl;
  return mapa;
}
```

- [ ] **Step 2: Estado compartido del inventario**

Create `mobile/src/datos/InventarioContext.tsx`:
```tsx
import NetInfo from '@react-native-community/netinfo';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Medicamento } from '../dominio/tipos';
import { guardarCache, leerCache } from './cache';
import { ajustarEnvases, listarMedicamentos, urlsFirmadas } from './medicamentos';
import { supabase } from './supabase';

interface ValorInventario {
  medicamentos: Medicamento[];
  /** foto_path -> URL firmada (válida 1 hora) */
  fotos: Record<string, string>;
  cargando: boolean;
  sinConexion: boolean;
  /** ISO de los datos mostrados (última carga correcta o caché) */
  actualizadoEn: string | null;
  recargar: () => Promise<Medicamento[]>;
  ajustar: (id: string, delta: number) => Promise<void>;
}

const Contexto = createContext<ValorInventario | null>(null);

export function InventarioProvider({ activo, children }: { activo: boolean; children: ReactNode }) {
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([]);
  const [fotos, setFotos] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(true);
  const [sinConexion, setSinConexion] = useState(false);
  const [actualizadoEn, setActualizadoEn] = useState<string | null>(null);

  const recargar = useCallback(async (): Promise<Medicamento[]> => {
    try {
      const lista = await listarMedicamentos();
      const ahora = new Date();
      setMedicamentos(lista);
      setActualizadoEn(ahora.toISOString());
      await guardarCache(lista, ahora);
      const paths = lista.map((m) => m.foto_path).filter((p): p is string => !!p);
      setFotos(await urlsFirmadas(paths));
      return lista;
    } catch {
      const cache = await leerCache();
      if (cache) {
        setMedicamentos(cache.medicamentos);
        setActualizadoEn(cache.guardadoEn);
        return cache.medicamentos;
      }
      return [];
    } finally {
      setCargando(false);
    }
  }, []);

  const ajustar = useCallback(async (id: string, delta: number) => {
    const actualizado = await ajustarEnvases(id, delta);
    setMedicamentos((lista) => {
      const nueva = lista.map((m) => (m.id === id ? actualizado : m));
      guardarCache(nueva);
      return nueva;
    });
  }, []);

  useEffect(() => {
    if (!activo) {
      setMedicamentos([]);
      return;
    }
    // Mostrar la caché al instante mientras llega la lista real.
    leerCache().then((cache) => {
      if (cache) {
        setMedicamentos((actual) => (actual.length > 0 ? actual : cache.medicamentos));
        setActualizadoEn((actual) => actual ?? cache.guardadoEn);
      }
    });
    recargar();
    const canal = supabase
      .channel('medicamentos-cambios')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'medicamentos' }, () => {
        recargar();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [activo, recargar]);

  useEffect(() => {
    return NetInfo.addEventListener((estado) => {
      const desconectado = estado.isConnected === false;
      setSinConexion(desconectado);
      if (!desconectado && activo) recargar();
    });
  }, [activo, recargar]);

  const valor = useMemo(
    () => ({ medicamentos, fotos, cargando, sinConexion, actualizadoEn, recargar, ajustar }),
    [medicamentos, fotos, cargando, sinConexion, actualizadoEn, recargar, ajustar],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useInventario(): ValorInventario {
  const valor = useContext(Contexto);
  if (!valor) throw new Error('useInventario debe usarse dentro de InventarioProvider');
  return valor;
}
```

- [ ] **Step 3: Componentes de la lista y del aviso de conexión**

Create `mobile/src/ui/MedicamentoItem.tsx`:
```tsx
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { textoCantidad } from '../dominio/formato';
import type { Medicamento } from '../dominio/tipos';
import { colores } from './tema';

interface Props {
  medicamento: Medicamento;
  fotoUrl?: string;
  deshabilitado: boolean;
  onAjustar: (delta: number) => void;
  onPress: () => void;
}

export function MedicamentoItem({ medicamento: m, fotoUrl, deshabilitado, onAjustar, onPress }: Props) {
  const sinStock = m.cantidad_envases === 0;
  const detalle = [m.principios_activos.join(' · '), m.forma].filter(Boolean).join(' · ');
  return (
    <Pressable onPress={onPress} style={[estilos.fila, sinStock && estilos.apagado]}>
      {fotoUrl ? (
        <Image source={{ uri: fotoUrl }} style={estilos.miniatura} />
      ) : (
        <View style={[estilos.miniatura, estilos.sinFoto]}>
          <Text style={estilos.inicial}>{m.nombre_comercial.charAt(0).toUpperCase()}</Text>
        </View>
      )}
      <View style={estilos.info}>
        <Text style={estilos.nombre} numberOfLines={1}>{[m.nombre_comercial, m.dosis].filter(Boolean).join(' ')}</Text>
        <Text style={estilos.detalle} numberOfLines={1}>{detalle || 'Sin principio activo'}</Text>
        <Text style={[estilos.cantidad, sinStock && { color: colores.no }]}>{textoCantidad(m.cantidad_envases)}</Text>
      </View>
      <Pressable accessibilityLabel={`Restar un envase de ${m.nombre_comercial}`} disabled={deshabilitado || sinStock}
        onPress={() => onAjustar(-1)} style={[estilos.paso, (deshabilitado || sinStock) && estilos.inactivo]}>
        <Text style={estilos.pasoTexto}>−</Text>
      </Pressable>
      <Pressable accessibilityLabel={`Sumar un envase de ${m.nombre_comercial}`} disabled={deshabilitado}
        onPress={() => onAjustar(1)} style={[estilos.paso, deshabilitado && estilos.inactivo]}>
        <Text style={estilos.pasoTexto}>+</Text>
      </Pressable>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colores.blanco, borderWidth: 1,
    borderColor: colores.linea, borderRadius: 16, padding: 10, marginBottom: 8 },
  apagado: { opacity: 0.55 },
  miniatura: { width: 48, height: 48, borderRadius: 10 },
  sinFoto: { backgroundColor: colores.marcaClaro, alignItems: 'center', justifyContent: 'center' },
  inicial: { fontSize: 20, fontWeight: '700', color: colores.marcaOscuro },
  info: { flex: 1, minWidth: 0 },
  nombre: { fontSize: 15, fontWeight: '600', color: colores.tinta },
  detalle: { fontSize: 12, color: colores.suave, marginTop: 1 },
  cantidad: { fontSize: 12, fontWeight: '600', color: colores.marcaOscuro, marginTop: 3 },
  paso: { width: 34, height: 34, borderRadius: 10, backgroundColor: colores.marcaClaro, alignItems: 'center', justifyContent: 'center' },
  pasoTexto: { fontSize: 20, fontWeight: '700', color: colores.marcaOscuro },
  inactivo: { opacity: 0.4 },
});
```

Create `mobile/src/ui/AvisoConexion.tsx`:
```tsx
import { StyleSheet, Text, View } from 'react-native';
import { haceCuanto } from '../datos/cache';
import { colores } from './tema';

export function AvisoConexion({ sinConexion, actualizadoEn }: { sinConexion: boolean; actualizadoEn: string | null }) {
  if (!sinConexion) return null;
  return (
    <View style={estilos.aviso}>
      <Text style={estilos.texto}>
        Sin conexión · {actualizadoEn ? `datos de ${haceCuanto(actualizadoEn)}` : 'sin datos guardados'}
      </Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  aviso: { backgroundColor: colores.eqClaro, borderRadius: 10, padding: 8, marginBottom: 8 },
  texto: { color: '#7a4e08', fontSize: 12, textAlign: 'center' },
});
```

- [ ] **Step 4: Layout con el proveedor y todas las rutas**

Replace `mobile/app/_layout.tsx`:
```tsx
import { Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { InventarioProvider } from '../src/datos/InventarioContext';
import { useSesion } from '../src/datos/sesion';
import { colores } from '../src/ui/tema';

export default function RootLayout() {
  const { sesion, cargando } = useSesion();

  if (cargando) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colores.fondo }}>
        <ActivityIndicator color={colores.marca} />
      </View>
    );
  }

  return (
    <InventarioProvider activo={!!sesion}>
      <Stack screenOptions={{ headerTintColor: colores.marcaOscuro, contentStyle: { backgroundColor: colores.fondo } }}>
        <Stack.Protected guard={!!sesion}>
          <Stack.Screen name="index" options={{ title: 'Botiquín de casa' }} />
          <Stack.Screen name="registrar" options={{ title: 'Nuevo medicamento' }} />
          <Stack.Screen name="buscar-foto" options={{ title: '¿Lo tengo en casa?' }} />
          <Stack.Screen name="medicamento/[id]" options={{ title: 'Detalle' }} />
        </Stack.Protected>
        <Stack.Protected guard={!sesion}>
          <Stack.Screen name="login" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </InventarioProvider>
  );
}
```

- [ ] **Step 5: Pantalla de inventario**

Replace `mobile/app/index.tsx`:
```tsx
import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useInventario } from '../src/datos/InventarioContext';
import { supabase } from '../src/datos/supabase';
import { buscarPorTexto } from '../src/dominio/buscar';
import type { Medicamento } from '../src/dominio/tipos';
import { AvisoConexion } from '../src/ui/AvisoConexion';
import { confirmar } from '../src/ui/confirmar';
import { MedicamentoItem } from '../src/ui/MedicamentoItem';
import { colores } from '../src/ui/tema';

type Filtro = 'todos' | 'con' | 'sin';

export default function Inventario() {
  const { medicamentos, fotos, cargando, sinConexion, actualizadoEn, recargar, ajustar } = useInventario();
  const [consulta, setConsulta] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [refrescando, setRefrescando] = useState(false);

  const visibles = useMemo(
    () =>
      buscarPorTexto(consulta, medicamentos).filter(
        (m) => filtro === 'todos' || (filtro === 'con' ? m.cantidad_envases > 0 : m.cantidad_envases === 0),
      ),
    [consulta, filtro, medicamentos],
  );
  const conStock = medicamentos.filter((m) => m.cantidad_envases > 0).length;

  function alAjustar(m: Medicamento, delta: number) {
    const hacer = () =>
      ajustar(m.id, delta).catch(() => Alert.alert('No se pudo actualizar', 'Revisa tu conexión e inténtalo de nuevo.'));
    if (delta < 0 && m.cantidad_envases === 1) {
      confirmar('¿Se acabó?', `${m.nombre_comercial} quedará como "Sin stock".`, 'Sí, se acabó').then((ok) => ok && hacer());
    } else {
      hacer();
    }
  }

  async function salir() {
    if (await confirmar('Cerrar sesión', '¿Quieres cerrar sesión en este teléfono?', 'Cerrar sesión')) {
      await supabase.auth.signOut();
    }
  }

  async function refrescar() {
    setRefrescando(true);
    await recargar();
    setRefrescando(false);
  }

  const filtros: Array<[Filtro, string]> = [
    ['todos', `Todos · ${medicamentos.length}`],
    ['con', `Con stock · ${conStock}`],
    ['sin', `Sin stock · ${medicamentos.length - conStock}`],
  ];

  return (
    <View style={estilos.pantalla}>
      <Stack.Screen options={{ headerRight: () => <Pressable onPress={salir}><Text style={estilos.salir}>Salir</Text></Pressable> }} />

      <View style={estilos.busqueda}>
        <TextInput style={estilos.campo} value={consulta} onChangeText={setConsulta}
          placeholder="Buscar por nombre o componente…" clearButtonMode="while-editing" />
        <Pressable accessibilityLabel="Buscar por foto" disabled={sinConexion}
          onPress={() => router.push('/buscar-foto')} style={[estilos.camara, sinConexion && estilos.inactivo]}>
          <Text style={estilos.camaraTexto}>📷</Text>
        </Pressable>
      </View>

      <View style={estilos.chips}>
        {filtros.map(([clave, texto]) => (
          <Pressable key={clave} onPress={() => setFiltro(clave)} style={[estilos.chip, filtro === clave && estilos.chipActivo]}>
            <Text style={[estilos.chipTexto, filtro === clave && estilos.chipTextoActivo]}>{texto}</Text>
          </Pressable>
        ))}
      </View>

      <AvisoConexion sinConexion={sinConexion} actualizadoEn={actualizadoEn} />

      <FlatList
        data={visibles}
        keyExtractor={(m) => m.id}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} />}
        contentContainerStyle={{ paddingBottom: 96 }}
        ListEmptyComponent={
          <Text style={estilos.vacio}>
            {cargando ? 'Cargando…' : consulta ? 'No hay coincidencias en casa.' : 'Aún no hay medicamentos. Registra el primero.'}
          </Text>
        }
        renderItem={({ item }) => (
          <MedicamentoItem
            medicamento={item}
            fotoUrl={item.foto_path ? fotos[item.foto_path] : undefined}
            deshabilitado={sinConexion}
            onAjustar={(delta) => alAjustar(item, delta)}
            onPress={() => router.push({ pathname: '/medicamento/[id]', params: { id: item.id } })}
          />
        )}
      />

      <Pressable disabled={sinConexion} onPress={() => router.push('/registrar')}
        style={[estilos.fab, sinConexion && estilos.inactivo]}>
        <Text style={estilos.fabTexto}>+  Registrar</Text>
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, paddingHorizontal: 14, paddingTop: 10, backgroundColor: colores.fondo },
  salir: { color: colores.marcaOscuro, fontWeight: '600' },
  busqueda: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  campo: { flex: 1, backgroundColor: colores.blanco, borderWidth: 1, borderColor: colores.linea, borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  camara: { width: 48, borderRadius: 14, backgroundColor: colores.marca, alignItems: 'center', justifyContent: 'center' },
  camaraTexto: { fontSize: 20 },
  chips: { flexDirection: 'row', gap: 6, marginBottom: 10, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: colores.blanco, borderWidth: 1, borderColor: colores.linea },
  chipActivo: { backgroundColor: colores.marcaClaro, borderColor: 'transparent' },
  chipTexto: { fontSize: 12, color: colores.suave },
  chipTextoActivo: { color: colores.marcaOscuro, fontWeight: '600' },
  vacio: { textAlign: 'center', color: colores.suave, marginTop: 40 },
  fab: { position: 'absolute', right: 16, bottom: 24, backgroundColor: colores.marca, paddingHorizontal: 20,
    paddingVertical: 14, borderRadius: 18, elevation: 4 },
  fabTexto: { color: colores.blanco, fontWeight: '700', fontSize: 15 },
  inactivo: { opacity: 0.5 },
});
```

Crear pantallas provisionales para que existan las rutas declaradas en el layout (las Tareas 11 a 13 las reemplazan). Crear `mobile/app/registrar.tsx`, `mobile/app/buscar-foto.tsx` y `mobile/app/medicamento/[id].tsx`, cada una con:
```tsx
import { Text, View } from 'react-native';

export default function Pendiente() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Próximamente</Text>
    </View>
  );
}
```

- [ ] **Step 6: Verificar**

Run (en `mobile/`): `npm run typecheck && npx jest`
Expected: sin errores de tipos y todas las pruebas en verde.

Verificación manual con Expo Go (con la persona usuaria). Primero, insertar dos filas de prueba desde **Supabase → Table Editor → medicamentos** (por ejemplo, "Kitadol", `{paracetamol}`, "500 mg", 2; y "Loratadina", `{loratadina}`, "10 mg", 0).
1. La lista muestra Kitadol primero y Loratadina en gris con "Sin stock".
2. Escribir "paracetamo" filtra Kitadol; los filtros Con stock / Sin stock funcionan.
3. **+** suma; **−** de 1 a 0 pide confirmación.
4. Cambiar la cantidad desde el Table Editor actualiza el teléfono sin tocar nada (tiempo real).
5. Activar el **modo avión**: aparece "Sin conexión · datos de hace…", la lista y la búsqueda siguen funcionando, y los botones quedan deshabilitados.
6. Borrar las filas de prueba al terminar.

- [ ] **Step 7: Commit**

```bash
cd /home/jonathan/Documents/Projects/FarmaSnap
git add mobile/src mobile/app
git commit -m "feat(app): inventario compartido con búsqueda, filtros, tiempo real y modo sin conexión"
```

---

### Task 11: App — cámara, formulario y registro de medicamentos

**Files:**
- Create: `mobile/src/ui/CapturaFoto.tsx`, `mobile/src/ui/FormularioMedicamento.tsx`
- Modify (reemplazar): `mobile/app/registrar.tsx`

**Interfaces:**
- Consumes: `prepararFoto`, `FotoPreparada`, `analizarFoto`, `mensajeErrorAnalisis`, `leerCapturaPendiente`, `limpiarCapturaPendiente` (Task 9); `crearMedicamento`, `subirFoto`, `eliminarFoto`, `ErrorDuplicado`, `useInventario` (Task 10); `buscarDuplicado`, `parsearPrincipios`, `textoOpcional`, `valoresDesdeExtraccion`, `textoCantidad` (Task 7); `Boton`, `confirmar`, `colores` (Task 8).
- Produces:
  - `<CapturaFoto onCaptura={(f: FotoPreparada) => void} onCancelar={() => void} indicacion?={string} />`
  - `<FormularioMedicamento inicial={ValoresFormulario} mostrarCantidad?={boolean} textoGuardar={string} guardando={boolean} onGuardar={(v: ValoresFormulario) => void} />`

- [ ] **Step 1: Componente de cámara**

Create `mobile/src/ui/CapturaFoto.tsx`:
```tsx
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { type FotoPreparada, prepararFoto } from '../datos/imagen';
import { Boton } from './Boton';
import { colores } from './tema';

interface Props {
  onCaptura: (foto: FotoPreparada) => void;
  onCancelar: () => void;
  indicacion?: string;
}

export function CapturaFoto({ onCaptura, onCancelar, indicacion = 'Encuadra el frente de la caja' }: Props) {
  const [permiso, pedirPermiso] = useCameraPermissions();
  const camara = useRef<CameraView>(null);
  const [procesando, setProcesando] = useState(false);

  if (!permiso) return <View style={estilos.negro} />;

  if (!permiso.granted) {
    return (
      <View style={estilos.permiso}>
        <Text style={estilos.permisoTexto}>FarmaSnap necesita la cámara para leer las cajas de los medicamentos.</Text>
        <Boton titulo="Permitir cámara" onPress={() => { pedirPermiso(); }} />
        <Boton titulo="Cancelar" variante="secundario" onPress={onCancelar} />
      </View>
    );
  }

  async function capturar() {
    if (!camara.current || procesando) return;
    setProcesando(true);
    try {
      const foto = await camara.current.takePictureAsync({ quality: 0.9 });
      if (foto) onCaptura(await prepararFoto(foto.uri, foto.width, foto.height));
    } catch {
      Alert.alert('No se pudo tomar la foto', 'Inténtalo de nuevo.');
    } finally {
      setProcesando(false);
    }
  }

  return (
    <View style={estilos.negro}>
      <CameraView ref={camara} style={StyleSheet.absoluteFill} facing="back" />
      <Text style={estilos.indicacion}>{indicacion}</Text>
      <View style={estilos.marco} pointerEvents="none" />
      <View style={estilos.barra}>
        <Pressable onPress={onCancelar} style={estilos.lado}><Text style={estilos.cancelar}>Cancelar</Text></Pressable>
        <Pressable accessibilityLabel="Tomar foto" onPress={capturar} disabled={procesando} style={estilos.obturador}>
          {procesando ? <ActivityIndicator color={colores.blanco} /> : <View style={estilos.obturadorInterno} />}
        </Pressable>
        <View style={estilos.lado} />
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  negro: { flex: 1, backgroundColor: '#141c1b' },
  permiso: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colores.fondo },
  permisoTexto: { textAlign: 'center', fontSize: 15, color: colores.tinta, marginBottom: 12 },
  indicacion: { position: 'absolute', top: 20, left: 0, right: 0, textAlign: 'center', color: colores.blanco, fontSize: 14 },
  marco: { position: 'absolute', top: '25%', left: '10%', right: '10%', height: '35%', borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.85)', borderRadius: 16 },
  barra: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 120, backgroundColor: 'rgba(13,19,18,0.85)',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24 },
  lado: { width: 80 },
  cancelar: { color: colores.blanco, fontSize: 15 },
  obturador: { width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: colores.blanco,
    alignItems: 'center', justifyContent: 'center' },
  obturadorInterno: { width: 54, height: 54, borderRadius: 27, backgroundColor: colores.blanco },
});
```

- [ ] **Step 2: Formulario reutilizable**

Create `mobile/src/ui/FormularioMedicamento.tsx`:
```tsx
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { parsearPrincipios, textoOpcional } from '../dominio/formato';
import type { ValoresFormulario } from '../dominio/tipos';
import { Boton } from './Boton';
import { colores } from './tema';

interface Props {
  inicial: ValoresFormulario;
  mostrarCantidad?: boolean;
  textoGuardar: string;
  guardando: boolean;
  onGuardar: (valores: ValoresFormulario) => void;
}

export function FormularioMedicamento({ inicial, mostrarCantidad = true, textoGuardar, guardando, onGuardar }: Props) {
  const [nombre, setNombre] = useState(inicial.nombre_comercial);
  const [principios, setPrincipios] = useState(inicial.principios_activos.join(', '));
  const [dosis, setDosis] = useState(inicial.dosis ?? '');
  const [forma, setForma] = useState(inicial.forma ?? '');
  const [laboratorio, setLaboratorio] = useState(inicial.laboratorio ?? '');
  const [cantidad, setCantidad] = useState(inicial.cantidad_envases);

  function guardar() {
    onGuardar({
      nombre_comercial: textoOpcional(nombre) ?? '',
      principios_activos: parsearPrincipios(principios),
      dosis: textoOpcional(dosis),
      forma: textoOpcional(forma)?.toLowerCase() ?? null,
      laboratorio: textoOpcional(laboratorio),
      cantidad_envases: cantidad,
    });
  }

  return (
    <View>
      <Campo etiqueta="Nombre comercial *" valor={nombre} onCambio={setNombre} ejemplo="Kitadol" />
      <Campo etiqueta="Principio activo (separa con comas)" valor={principios} onCambio={setPrincipios}
        ejemplo="paracetamol" minusculas />
      <View style={estilos.fila}>
        <View style={{ flex: 1 }}><Campo etiqueta="Dosis" valor={dosis} onCambio={setDosis} ejemplo="500 mg" /></View>
        <View style={{ flex: 1 }}><Campo etiqueta="Forma" valor={forma} onCambio={setForma} ejemplo="comprimidos" minusculas /></View>
      </View>
      <Campo etiqueta="Laboratorio" valor={laboratorio} onCambio={setLaboratorio} ejemplo="Laboratorio Chile" />

      {mostrarCantidad && (
        <View style={estilos.cantidad}>
          <Text style={estilos.etiqueta}>ENVASES</Text>
          <View style={estilos.pasos}>
            <Pressable accessibilityLabel="Menos envases" onPress={() => setCantidad((c) => Math.max(1, c - 1))} style={estilos.paso}>
              <Text style={estilos.pasoTexto}>−</Text>
            </Pressable>
            <Text style={estilos.numero}>{cantidad}</Text>
            <Pressable accessibilityLabel="Más envases" onPress={() => setCantidad((c) => c + 1)} style={estilos.paso}>
              <Text style={estilos.pasoTexto}>+</Text>
            </Pressable>
          </View>
        </View>
      )}

      <Boton titulo={textoGuardar} onPress={guardar} cargando={guardando} deshabilitado={!textoOpcional(nombre)} />
    </View>
  );
}

function Campo(props: { etiqueta: string; valor: string; onCambio: (t: string) => void; ejemplo: string; minusculas?: boolean }) {
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={estilos.etiqueta}>{props.etiqueta.toUpperCase()}</Text>
      <TextInput style={estilos.campo} value={props.valor} onChangeText={props.onCambio} placeholder={props.ejemplo}
        autoCapitalize={props.minusculas ? 'none' : 'sentences'} />
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', gap: 8 },
  etiqueta: { fontSize: 11, fontWeight: '600', color: colores.suave, letterSpacing: 0.4 },
  campo: { backgroundColor: colores.blanco, borderWidth: 1, borderColor: colores.linea, borderRadius: 11,
    paddingHorizontal: 11, paddingVertical: 9, fontSize: 15, marginTop: 3 },
  cantidad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 6 },
  pasos: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  paso: { width: 38, height: 38, borderRadius: 10, backgroundColor: colores.marcaClaro, alignItems: 'center', justifyContent: 'center' },
  pasoTexto: { fontSize: 20, fontWeight: '700', color: colores.marcaOscuro },
  numero: { fontSize: 18, fontWeight: '700', color: colores.tinta, minWidth: 24, textAlign: 'center' },
});
```

- [ ] **Step 3: Pantalla de registro**

Replace `mobile/app/registrar.tsx`:
```tsx
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { analizarFoto } from '../src/datos/analizarFoto';
import { leerCapturaPendiente, limpiarCapturaPendiente } from '../src/datos/capturaTemporal';
import { mensajeErrorAnalisis } from '../src/datos/erroresFunciones';
import type { FotoPreparada } from '../src/datos/imagen';
import { useInventario } from '../src/datos/InventarioContext';
import { crearMedicamento, eliminarFoto, ErrorDuplicado, subirFoto } from '../src/datos/medicamentos';
import { buscarDuplicado } from '../src/dominio/buscar';
import { textoCantidad, valoresDesdeExtraccion } from '../src/dominio/formato';
import type { Medicamento, ValoresFormulario } from '../src/dominio/tipos';
import { Boton } from '../src/ui/Boton';
import { CapturaFoto } from '../src/ui/CapturaFoto';
import { confirmar } from '../src/ui/confirmar';
import { FormularioMedicamento } from '../src/ui/FormularioMedicamento';
import { colores } from '../src/ui/tema';

const VACIO: ValoresFormulario = {
  nombre_comercial: '', principios_activos: [], dosis: null, forma: null, laboratorio: null, cantidad_envases: 1,
};

type Paso =
  | { tipo: 'camara' }
  | { tipo: 'analizando' }
  | { tipo: 'error'; mensaje: string }
  | { tipo: 'formulario'; inicial: ValoresFormulario; leidoPorIa: boolean; clave: number };

export default function Registrar() {
  const { medicamentos, recargar, ajustar } = useInventario();
  const [inicio] = useState(() => leerCapturaPendiente());
  const [foto, setFoto] = useState<FotoPreparada | null>(inicio?.foto ?? null);
  const [paso, setPaso] = useState<Paso>(
    inicio
      ? { tipo: 'formulario', inicial: valoresDesdeExtraccion(inicio.datos), leidoPorIa: true, clave: 0 }
      : { tipo: 'camara' },
  );
  const [guardando, setGuardando] = useState(false);
  const [duplicado, setDuplicado] = useState<{ existente: Medicamento; cantidad: number } | null>(null);

  useEffect(() => () => limpiarCapturaPendiente(), []);

  function mostrarFormulario(inicial: ValoresFormulario, leidoPorIa: boolean) {
    setPaso({ tipo: 'formulario', inicial, leidoPorIa, clave: Date.now() });
  }

  async function alCapturar(f: FotoPreparada) {
    setFoto(f);
    setPaso({ tipo: 'analizando' });
    try {
      const e = await analizarFoto(f.base64);
      if (!e.es_medicamento) return setPaso({ tipo: 'error', mensaje: 'La foto no parece ser de un medicamento.' });
      if (!e.legible) {
        return setPaso({ tipo: 'error', mensaje: 'No pude leer la caja. Prueba con más luz y encuadrando el frente.' });
      }
      mostrarFormulario(valoresDesdeExtraccion(e), true);
    } catch (error) {
      setPaso({ tipo: 'error', mensaje: mensajeErrorAnalisis(error) });
    }
  }

  async function guardar(v: ValoresFormulario) {
    const existente = buscarDuplicado(v, medicamentos);
    if (existente) return setDuplicado({ existente, cantidad: v.cantidad_envases });
    if (v.principios_activos.length === 0) {
      const seguir = await confirmar('Sin principio activo',
        'Sin principio activo no podré encontrar equivalentes. ¿Guardar igual?', 'Guardar');
      if (!seguir) return;
    }

    setGuardando(true);
    let fotoPath: string | null = null;
    try {
      if (foto) fotoPath = await subirFoto(foto.base64).catch(() => null); // sin foto si falla la subida
      await crearMedicamento({ ...v, foto_path: fotoPath });
      await recargar();
      router.back();
    } catch (error) {
      if (fotoPath) await eliminarFoto(fotoPath).catch(() => undefined);
      if (error instanceof ErrorDuplicado) {
        const lista = await recargar();
        const ex = buscarDuplicado(v, lista);
        if (ex) setDuplicado({ existente: ex, cantidad: v.cantidad_envases });
      } else {
        Alert.alert('No se pudo guardar', 'Revisa tu conexión e inténtalo de nuevo.');
      }
    } finally {
      setGuardando(false);
    }
  }

  async function sumarAlExistente() {
    if (!duplicado) return;
    setGuardando(true);
    try {
      await ajustar(duplicado.existente.id, duplicado.cantidad);
      router.back();
    } catch {
      Alert.alert('No se pudo actualizar', 'Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  if (paso.tipo === 'camara') {
    return <CapturaFoto onCaptura={alCapturar} onCancelar={() => router.back()} />;
  }

  if (paso.tipo === 'analizando') {
    return (
      <View style={estilos.centro}>
        <ActivityIndicator size="large" color={colores.marca} />
        <Text style={estilos.texto}>Leyendo caja…</Text>
      </View>
    );
  }

  if (paso.tipo === 'error') {
    return (
      <View style={estilos.centro}>
        <Text style={estilos.texto}>{paso.mensaje}</Text>
        <Boton titulo="Reintentar foto" onPress={() => setPaso({ tipo: 'camara' })} />
        <Boton titulo="Escribir a mano" variante="secundario" onPress={() => mostrarFormulario(VACIO, false)} />
      </View>
    );
  }

  const quedan = duplicado ? duplicado.existente.cantidad_envases + duplicado.cantidad : 0;
  return (
    <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
      {foto && (
        <View>
          <Image source={{ uri: foto.uri }} style={estilos.foto} />
          {paso.leidoPorIa && <Text style={estilos.insignia}>✦ Leído por IA · revisa los datos</Text>}
        </View>
      )}

      {duplicado && (
        <View style={estilos.duplicado}>
          <Text style={estilos.duplicadoTexto}>
            Ya tienes <Text style={{ fontWeight: '700' }}>{duplicado.existente.nombre_comercial} {duplicado.existente.dosis ?? ''}</Text>{' '}
            ({textoCantidad(duplicado.existente.cantidad_envases)}).
          </Text>
          <Boton titulo={`Sumar ${duplicado.cantidad} (quedan ${quedan})`} onPress={sumarAlExistente} cargando={guardando} />
          <Boton titulo="Editar datos" variante="secundario" onPress={() => setDuplicado(null)} />
        </View>
      )}

      {!duplicado && (
        <FormularioMedicamento key={paso.clave} inicial={paso.inicial} textoGuardar="Guardar"
          guardando={guardando} onGuardar={guardar} />
      )}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  centro: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colores.fondo },
  texto: { textAlign: 'center', fontSize: 15, color: colores.tinta, marginVertical: 12 },
  contenido: { padding: 14, paddingBottom: 40 },
  foto: { height: 160, borderRadius: 14, marginBottom: 8, backgroundColor: colores.linea },
  insignia: { color: colores.marcaOscuro, fontSize: 12, fontWeight: '600', marginBottom: 10 },
  duplicado: { backgroundColor: colores.eqClaro, borderRadius: 12, padding: 12, marginBottom: 10 },
  duplicadoTexto: { color: '#7a4e08', fontSize: 14 },
});
```

- [ ] **Step 4: Verificar**

Run (en `mobile/`): `npm run typecheck && npx jest`
Expected: sin errores de tipos y todas las pruebas en verde.

Verificación manual con Expo Go (con la persona usuaria y una caja real):
1. **Registrar** → pide permiso de cámara → foto → "Leyendo caja…" → formulario prellenado con la insignia "Leído por IA".
2. Guardar → vuelve al inventario con el medicamento y su miniatura.
3. Registrar la misma caja otra vez → aparece "Ya tienes… Sumar 1 (quedan 2)" → al sumar, la cantidad es 2.
4. Una foto del techo → "La foto no parece ser de un medicamento." → **Escribir a mano** abre el formulario vacío.
5. Guardar sin principio activo → pide confirmación.

- [ ] **Step 5: Commit**

```bash
cd /home/jonathan/Documents/Projects/FarmaSnap
git add mobile/src/ui mobile/app/registrar.tsx
git commit -m "feat(app): registro por foto con IA, formulario editable y detección de duplicados"
```

---

### Task 12: App — búsqueda por foto

**Files:**
- Create: `mobile/src/ui/ResultadoBusqueda.tsx`
- Modify (reemplazar): `mobile/app/buscar-foto.tsx`

**Interfaces:**
- Consumes: `CapturaFoto` (Task 11); `analizarFoto`, `mensajeErrorAnalisis`, `guardarCapturaPendiente`, `FotoPreparada` (Task 9); `useInventario` (Task 10); `clasificarResultado` (Task 6); `textoCantidad` (Task 7).
- Produces: `<ResultadoBusqueda resultado={ResultadoBusqueda} buscado={Extraccion} onAbrir={(id: string) => void} />`

- [ ] **Step 1: Tarjetas de resultado**

Create `mobile/src/ui/ResultadoBusqueda.tsx`:
```tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { textoCantidad } from '../dominio/formato';
import type { Extraccion, Medicamento, ResultadoBusqueda as Resultado } from '../dominio/tipos';
import { colores } from './tema';

interface Props {
  resultado: Resultado;
  buscado: Extraccion;
  onAbrir: (id: string) => void;
}

function nombreCompleto(m: Medicamento): string {
  return [m.nombre_comercial, m.dosis].filter(Boolean).join(' ');
}

export function ResultadoBusqueda({ resultado, buscado, onAbrir }: Props) {
  if (resultado.tipo === 'tiene') {
    const m = resultado.medicamento;
    return (
      <Pressable onPress={() => onAbrir(m.id)} style={[estilos.tarjeta, { backgroundColor: colores.okClaro }]}>
        <Text style={[estilos.titulo, { color: colores.ok }]}>✓ Ya lo tienes</Text>
        <Text style={estilos.texto}><Text style={estilos.negrita}>{nombreCompleto(m)}</Text>: {textoCantidad(m.cantidad_envases)} en casa</Text>
      </Pressable>
    );
  }

  if (resultado.tipo === 'equivalente') {
    return (
      <View style={[estilos.tarjeta, { backgroundColor: colores.eqClaro }]}>
        <Text style={[estilos.titulo, { color: colores.eq }]}>≈ Tienes un equivalente</Text>
        {resultado.coincidencias.map(({ medicamento: m, dosisDistinta }) => (
          <Pressable key={m.id} onPress={() => onAbrir(m.id)} style={estilos.coincidencia}>
            <Text style={estilos.texto}><Text style={estilos.negrita}>{nombreCompleto(m)}</Text>: {textoCantidad(m.cantidad_envases)}</Text>
            <Text style={estilos.sub}>Mismo principio activo: {m.principios_activos.join(' + ')}</Text>
            {dosisDistinta && <Text style={estilos.aviso}>⚠ Dosis distinta: tú buscas {buscado.dosis ?? 'otra dosis'}</Text>}
          </Pressable>
        ))}
      </View>
    );
  }

  return (
    <View style={[estilos.tarjeta, { backgroundColor: colores.noClaro }]}>
      <Text style={[estilos.titulo, { color: colores.no }]}>✕ No lo tienes en casa</Text>
      {resultado.agotado && (
        <Text style={estilos.texto}>Lo tenían ({nombreCompleto(resultado.agotado)}), pero se acabó.</Text>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  tarjeta: { borderRadius: 16, padding: 14, marginBottom: 10 },
  titulo: { fontWeight: '700', fontSize: 16, marginBottom: 6 },
  texto: { fontSize: 14, color: colores.tinta },
  negrita: { fontWeight: '700' },
  coincidencia: { paddingVertical: 6 },
  sub: { fontSize: 12, color: colores.suave, marginTop: 2 },
  aviso: { fontSize: 12, color: '#7a4e08', marginTop: 4 },
});
```

- [ ] **Step 2: Pantalla de búsqueda por foto**

Replace `mobile/app/buscar-foto.tsx`:
```tsx
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { analizarFoto } from '../src/datos/analizarFoto';
import { guardarCapturaPendiente } from '../src/datos/capturaTemporal';
import { mensajeErrorAnalisis } from '../src/datos/erroresFunciones';
import type { FotoPreparada } from '../src/datos/imagen';
import { useInventario } from '../src/datos/InventarioContext';
import { clasificarResultado } from '../src/dominio/clasificar';
import type { Extraccion, ResultadoBusqueda as Resultado } from '../src/dominio/tipos';
import { Boton } from '../src/ui/Boton';
import { CapturaFoto } from '../src/ui/CapturaFoto';
import { ResultadoBusqueda } from '../src/ui/ResultadoBusqueda';
import { colores } from '../src/ui/tema';

type Paso =
  | { tipo: 'camara' }
  | { tipo: 'analizando' }
  | { tipo: 'error'; mensaje: string }
  | { tipo: 'resultado'; extraccion: Extraccion; resultado: Resultado; foto: FotoPreparada };

export default function BuscarFoto() {
  const { medicamentos } = useInventario();
  const [paso, setPaso] = useState<Paso>({ tipo: 'camara' });

  async function alCapturar(foto: FotoPreparada) {
    setPaso({ tipo: 'analizando' });
    try {
      const e = await analizarFoto(foto.base64);
      if (!e.es_medicamento) return setPaso({ tipo: 'error', mensaje: 'La foto no parece ser de un medicamento.' });
      if (!e.legible) {
        return setPaso({ tipo: 'error', mensaje: 'No pude leer la caja. Prueba con más luz y encuadrando el frente.' });
      }
      const resultado = clasificarResultado(
        { nombre_comercial: e.nombre_comercial ?? '', principios_activos: e.principios_activos, dosis: e.dosis },
        medicamentos,
      );
      setPaso({ tipo: 'resultado', extraccion: e, resultado, foto });
    } catch (error) {
      setPaso({ tipo: 'error', mensaje: mensajeErrorAnalisis(error) });
    }
  }

  if (paso.tipo === 'camara') {
    return <CapturaFoto onCaptura={alCapturar} onCancelar={() => router.back()} indicacion="Fotografía la caja que vas a comprar" />;
  }

  if (paso.tipo === 'analizando') {
    return (
      <View style={estilos.centro}>
        <ActivityIndicator size="large" color={colores.marca} />
        <Text style={estilos.texto}>Buscando en el botiquín…</Text>
      </View>
    );
  }

  if (paso.tipo === 'error') {
    return (
      <View style={estilos.centro}>
        <Text style={estilos.texto}>{paso.mensaje}</Text>
        <Boton titulo="Reintentar" onPress={() => setPaso({ tipo: 'camara' })} />
        <Boton titulo="Buscar escribiendo" variante="secundario" onPress={() => router.back()} />
      </View>
    );
  }

  const e = paso.extraccion;
  return (
    <ScrollView contentContainerStyle={estilos.contenido}>
      <View style={estilos.buscado}>
        <Text style={estilos.buscadoNombre}>{[e.nombre_comercial, e.dosis].filter(Boolean).join(' ')}</Text>
        <Text style={estilos.buscadoDetalle}>{e.principios_activos.join(' + ') || 'Principio activo no leído'}</Text>
      </View>

      <ResultadoBusqueda resultado={paso.resultado} buscado={e}
        onAbrir={(id) => router.push({ pathname: '/medicamento/[id]', params: { id } })} />

      <Boton titulo="Lo compré · registrar" variante="secundario" onPress={() => {
        guardarCapturaPendiente({ datos: e, foto: paso.foto });
        router.replace('/registrar');
      }} />
      <Boton titulo="Buscar otro" variante="secundario" onPress={() => setPaso({ tipo: 'camara' })} />
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  centro: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colores.fondo },
  texto: { textAlign: 'center', fontSize: 15, color: colores.tinta, marginVertical: 12 },
  contenido: { padding: 14, paddingBottom: 40 },
  buscado: { backgroundColor: colores.blanco, borderWidth: 1, borderColor: colores.linea, borderRadius: 14, padding: 12, marginBottom: 12 },
  buscadoNombre: { fontSize: 16, fontWeight: '700', color: colores.tinta },
  buscadoDetalle: { fontSize: 12, color: colores.suave, marginTop: 2 },
});
```

- [ ] **Step 3: Verificar**

Run (en `mobile/`): `npm run typecheck && npx jest`
Expected: sin errores de tipos y todas las pruebas en verde.

Verificación manual con Expo Go (con la persona usuaria):
1. Con Kitadol registrado, buscar por foto la misma caja → tarjeta verde "Ya lo tienes".
2. Buscar una caja de otra marca de paracetamol → tarjeta ámbar con Kitadol (y aviso de dosis si corresponde).
3. Buscar algo que no hay en casa → tarjeta roja → **Lo compré · registrar** abre el formulario prellenado con la misma foto, sin sacar otra.
4. Restar Kitadol a 0 y buscarlo de nuevo → "No lo tienes en casa · Lo tenían…, pero se acabó".

- [ ] **Step 4: Commit**

```bash
cd /home/jonathan/Documents/Projects/FarmaSnap
git add mobile/src/ui/ResultadoBusqueda.tsx mobile/app/buscar-foto.tsx
git commit -m "feat(app): búsqueda por foto con resultado verde, ámbar o rojo"
```

---

### Task 13: App — detalle, edición y eliminación

**Files:**
- Modify (reemplazar): `mobile/app/medicamento/[id].tsx`

**Interfaces:**
- Consumes: `useInventario` (Task 10); `actualizarMedicamento`, `eliminarMedicamento`, `ErrorDuplicado` (Task 10); `FormularioMedicamento` (Task 11); `buscarDuplicado`, `textoCantidad` (Task 7); `Boton`, `confirmar`, `colores` (Task 8).
- Produces: pantalla `medicamento/[id]`.

- [ ] **Step 1: Pantalla de detalle**

Replace `mobile/app/medicamento/[id].tsx`:
```tsx
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useInventario } from '../../src/datos/InventarioContext';
import { actualizarMedicamento, eliminarMedicamento, ErrorDuplicado } from '../../src/datos/medicamentos';
import { buscarDuplicado } from '../../src/dominio/buscar';
import { textoCantidad } from '../../src/dominio/formato';
import type { ValoresFormulario } from '../../src/dominio/tipos';
import { Boton } from '../../src/ui/Boton';
import { confirmar } from '../../src/ui/confirmar';
import { FormularioMedicamento } from '../../src/ui/FormularioMedicamento';
import { colores } from '../../src/ui/tema';

export default function Detalle() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { medicamentos, fotos, sinConexion, ajustar, recargar } = useInventario();
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const encontrado = medicamentos.find((m) => m.id === id);

  if (!encontrado) {
    return (
      <View style={estilos.centro}>
        <Text style={estilos.texto}>Este medicamento ya no está en el inventario.</Text>
        <Boton titulo="Volver" onPress={() => router.back()} />
      </View>
    );
  }
  const m = encontrado;

  async function guardarEdicion(v: ValoresFormulario) {
    const otro = buscarDuplicado(v, medicamentos, m.id);
    if (otro) {
      Alert.alert('Ya existe', `Ya tienes ${otro.nombre_comercial} ${otro.dosis ?? ''}. Cambia el nombre o la dosis.`);
      return;
    }
    setGuardando(true);
    try {
      const { cantidad_envases: _sinUso, ...datos } = v;
      await actualizarMedicamento(m.id, datos);
      await recargar();
      setEditando(false);
    } catch (error) {
      Alert.alert(error instanceof ErrorDuplicado
        ? 'Ya existe un medicamento con ese nombre y dosis.'
        : 'No se pudo guardar. Revisa tu conexión.');
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar() {
    if (!(await confirmar('Eliminar medicamento', `¿Eliminar ${m.nombre_comercial} del inventario?`, 'Eliminar'))) return;
    try {
      await eliminarMedicamento(m);
      await recargar();
      router.back();
    } catch {
      Alert.alert('No se pudo eliminar', 'Revisa tu conexión e inténtalo de nuevo.');
    }
  }

  function alAjustar(delta: number) {
    const hacer = () => ajustar(m.id, delta).catch(() => Alert.alert('No se pudo actualizar', 'Revisa tu conexión.'));
    if (delta < 0 && m.cantidad_envases === 1) {
      confirmar('¿Se acabó?', `${m.nombre_comercial} quedará como "Sin stock".`, 'Sí, se acabó').then((ok) => ok && hacer());
    } else {
      hacer();
    }
  }

  const fotoUrl = m.foto_path ? fotos[m.foto_path] : undefined;
  const autor = m.actualizado_por_email?.split('@')[0];
  const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });

  return (
    <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
      {fotoUrl ? <Image source={{ uri: fotoUrl }} style={estilos.foto} /> : <View style={[estilos.foto, estilos.sinFoto]} />}

      {editando ? (
        <>
          <FormularioMedicamento inicial={m} mostrarCantidad={false} textoGuardar="Guardar cambios"
            guardando={guardando} onGuardar={guardarEdicion} />
          <Boton titulo="Cancelar" variante="secundario" onPress={() => setEditando(false)} />
        </>
      ) : (
        <>
          <View style={estilos.cabecera}>
            <View style={{ flex: 1 }}>
              <Text style={estilos.nombre}>{[m.nombre_comercial, m.dosis].filter(Boolean).join(' ')}</Text>
              {m.laboratorio && <Text style={estilos.lab}>{m.laboratorio}</Text>}
            </View>
            <Pressable disabled={sinConexion} onPress={() => setEditando(true)}>
              <Text style={[estilos.editar, sinConexion && { opacity: 0.4 }]}>Editar</Text>
            </Pressable>
          </View>

          <View style={estilos.datos}>
            <Dato etiqueta="Principio activo" valor={m.principios_activos.join(', ') || '—'} />
            <Dato etiqueta="Forma" valor={m.forma ?? '—'} />
            <Dato etiqueta="Dosis" valor={m.dosis ?? '—'} />
            <Dato etiqueta="Registrado" valor={fecha(m.creado_en)} />
          </View>

          <View style={estilos.cantidad}>
            <View>
              <Text style={estilos.cantidadEtiqueta}>En casa</Text>
              <Text style={estilos.cantidadValor}>{textoCantidad(m.cantidad_envases)}</Text>
            </View>
            <View style={estilos.pasos}>
              <Pressable accessibilityLabel="Restar un envase" disabled={sinConexion || m.cantidad_envases === 0}
                onPress={() => alAjustar(-1)} style={[estilos.paso, (sinConexion || m.cantidad_envases === 0) && { opacity: 0.4 }]}>
                <Text style={estilos.pasoTexto}>−</Text>
              </Pressable>
              <Pressable accessibilityLabel="Sumar un envase" disabled={sinConexion}
                onPress={() => alAjustar(1)} style={[estilos.paso, sinConexion && { opacity: 0.4 }]}>
                <Text style={estilos.pasoTexto}>+</Text>
              </Pressable>
            </View>
          </View>

          <Text style={estilos.auditoria}>
            Último cambio: {autor ?? 'desconocido'} · {fecha(m.actualizado_en)}
          </Text>
          <Boton titulo="Eliminar medicamento" variante="peligro" deshabilitado={sinConexion} onPress={eliminar} />
        </>
      )}
    </ScrollView>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View style={estilos.dato}>
      <Text style={estilos.datoEtiqueta}>{etiqueta.toUpperCase()}</Text>
      <Text style={estilos.datoValor}>{valor}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  centro: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colores.fondo },
  texto: { textAlign: 'center', fontSize: 15, color: colores.tinta, marginBottom: 12 },
  contenido: { padding: 14, paddingBottom: 40 },
  foto: { height: 200, borderRadius: 16, marginBottom: 12, backgroundColor: colores.linea },
  sinFoto: { backgroundColor: colores.marcaClaro },
  cabecera: { flexDirection: 'row', alignItems: 'flex-start' },
  nombre: { fontSize: 22, fontWeight: '700', color: colores.tinta },
  lab: { fontSize: 13, color: colores.suave, marginTop: 2 },
  editar: { color: colores.marca, fontWeight: '600', fontSize: 15 },
  datos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 12 },
  dato: { width: '48%', backgroundColor: colores.blanco, borderWidth: 1, borderColor: colores.linea, borderRadius: 12, padding: 10 },
  datoEtiqueta: { fontSize: 10, fontWeight: '600', color: colores.suave },
  datoValor: { fontSize: 14, fontWeight: '600', color: colores.tinta, marginTop: 2 },
  cantidad: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colores.marcaClaro, borderRadius: 14, padding: 12 },
  cantidadEtiqueta: { fontSize: 12, color: colores.marcaOscuro },
  cantidadValor: { fontSize: 22, fontWeight: '700', color: colores.marcaOscuro },
  pasos: { flexDirection: 'row', gap: 10 },
  paso: { width: 42, height: 42, borderRadius: 12, backgroundColor: colores.blanco, alignItems: 'center', justifyContent: 'center' },
  pasoTexto: { fontSize: 22, fontWeight: '700', color: colores.marcaOscuro },
  auditoria: { textAlign: 'center', fontSize: 12, color: colores.suave, marginVertical: 12 },
});
```

- [ ] **Step 2: Verificar**

Run (en `mobile/`): `npm run typecheck && npx jest`
Expected: sin errores de tipos y todas las pruebas en verde.

Verificación manual con Expo Go:
1. Tocar un medicamento abre el detalle con foto, datos, cantidad y "Último cambio: <usuario> · <fecha>".
2. **Editar** → cambiar la dosis a una que ya existe para ese nombre → "Ya existe…"; cambiarla a una nueva → se guarda.
3. **Eliminar** → confirmación → vuelve al inventario sin el medicamento.
4. Con dos teléfonos: si uno elimina el medicamento mientras el otro tiene abierto el detalle, el segundo muestra "Este medicamento ya no está en el inventario."

- [ ] **Step 3: Commit**

```bash
cd /home/jonathan/Documents/Projects/FarmaSnap
git add "mobile/app/medicamento/[id].tsx"
git commit -m "feat(app): detalle del medicamento con edición, ajuste de envases y eliminación"
```

---

### Task 14: Evaluación con fotos reales, pruebas manuales y APK

**Files:**
- Create: `supabase/functions/analizar-foto/eval.ts`, `eval/esperado.json`, `docs/pruebas-manuales.md`, `mobile/eas.json`
- Modify: `README.md` (sección "Cómo ejecutar")

**Interfaces:**
- Consumes: `extraerDeImagen`, `ClienteMensajes` (Task 4).
- Produces: informe de acierto de la IA, lista de verificación manual y un APK instalable.

- [ ] **Step 1: Script de evaluación**

Create `supabase/functions/analizar-foto/eval.ts`:
```ts
// Evaluación manual con fotos reales (consume crédito de Anthropic).
// Uso, desde la raíz del repositorio:
//   ANTHROPIC_API_KEY=... deno run --allow-env --allow-read --allow-net \
//     --config supabase/functions/analizar-foto/deno.json supabase/functions/analizar-foto/eval.ts eval
import Anthropic from "@anthropic-ai/sdk";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";
import { type ClienteMensajes, extraerDeImagen } from "./claude.ts";

interface Esperado {
  archivo: string;
  nombre_comercial: string;
  principios_activos: string[];
  dosis: string | null;
}

const norm = (t: string | null | undefined) =>
  (t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, "").trim();
const mismoConjunto = (a: string[], b: string[]) =>
  a.length === b.length && a.map(norm).sort().join("|") === b.map(norm).sort().join("|");

const carpeta = Deno.args[0] ?? "eval";
const casos: Esperado[] = JSON.parse(await Deno.readTextFile(`${carpeta}/esperado.json`));
const cliente = new Anthropic() as unknown as ClienteMensajes;

let aciertosNombre = 0, aciertosPrincipios = 0, aciertosDosis = 0;
for (const caso of casos) {
  const imagen = encodeBase64(await Deno.readFile(`${carpeta}/fotos/${caso.archivo}`));
  try {
    const r = await extraerDeImagen(cliente, imagen);
    const n = norm(r.nombre_comercial) === norm(caso.nombre_comercial);
    const p = mismoConjunto(r.principios_activos, caso.principios_activos);
    const d = norm(r.dosis) === norm(caso.dosis);
    aciertosNombre += Number(n);
    aciertosPrincipios += Number(p);
    aciertosDosis += Number(d);
    console.log(`${n && p && d ? "✔" : "✘"} ${caso.archivo}: ${r.nombre_comercial} | ${r.principios_activos.join("+")} | ${r.dosis}`);
  } catch (error) {
    console.log(`✘ ${caso.archivo}: error ${error}`);
  }
}
const pct = (x: number) => `${Math.round((100 * x) / casos.length)}%`;
console.log(`\nNombre: ${pct(aciertosNombre)} · Principio activo: ${pct(aciertosPrincipios)} · Dosis: ${pct(aciertosDosis)}`);
```

Create `eval/esperado.json` (la persona usuaria lo completa con sus 15–20 cajas; dejar este ejemplo como formato):
```json
[
  { "archivo": "kitadol.jpg", "nombre_comercial": "Kitadol", "principios_activos": ["paracetamol"], "dosis": "500 mg" }
]
```

- [ ] **Step 2: Ejecutar la evaluación (con la persona usuaria)**

1. La persona usuaria fotografía 15 a 20 cajas reales, copia las fotos a `eval/fotos/` y completa `eval/esperado.json`.
2. Reducir las fotos: `mogrify -resize 1000x1000 -quality 70 eval/fotos/*.jpg` (si falta: `sudo apt install imagemagick`).
3. La persona usuaria ejecuta el comando del encabezado de `eval.ts` con su clave.

Expected: un informe por caja y porcentajes finales. **Criterio:** nombre ≥ 85 % y principio activo ≥ 85 %. Si no se cumple, revisar los fallos, ajustar `INSTRUCCIONES` en `logica.ts`, volver a ejecutar `deno test` y la evaluación, y desplegar de nuevo la función.

- [ ] **Step 3: Lista de verificación manual**

Create `docs/pruebas-manuales.md`:
```markdown
# Pruebas manuales de FarmaSnap

Ejecutar en un Android con Expo Go (o con el APK) antes de cada versión. Marcar cada punto.

## Sesión
- [ ] Contraseña incorrecta muestra "Correo o contraseña incorrectos."
- [ ] Inicio de sesión correcto lleva al inventario.
- [ ] Al cerrar y reabrir la app, la sesión sigue iniciada.
- [ ] "Salir" vuelve a la pantalla de inicio de sesión.

## Registro
- [ ] Foto de una caja → formulario prellenado con "Leído por IA".
- [ ] Guardar → aparece en la lista con su miniatura.
- [ ] Registrar la misma caja → propone "Sumar" y suma correctamente.
- [ ] Foto que no es un medicamento → mensaje y opción "Escribir a mano".
- [ ] Guardar sin principio activo → pide confirmación.

## Inventario
- [ ] Búsqueda por nombre comercial y por principio activo; tolera tildes y un error de tipeo.
- [ ] Filtros Todos / Con stock / Sin stock.
- [ ] − de 1 a 0 pide confirmación y deja "Sin stock" al final, en gris.

## Búsqueda por foto
- [ ] Mismo producto con stock → verde "Ya lo tienes".
- [ ] Otra marca con el mismo principio activo → ámbar, con aviso si la dosis es distinta.
- [ ] Producto sin stock → rojo "Lo tenían, pero se acabó".
- [ ] "Lo compré · registrar" abre el formulario prellenado con la misma foto.

## Detalle
- [ ] Editar datos y guardar; editar a un duplicado muestra "Ya existe".
- [ ] Eliminar con confirmación.

## Familia y conexión
- [ ] Un cambio en un teléfono aparece en otro sin recargar.
- [ ] Modo avión: aviso "Sin conexión · datos de hace…", la lista y la búsqueda por texto funcionan, y los botones de cambio quedan deshabilitados.
- [ ] Al volver la conexión, el aviso desaparece y la lista se actualiza.
```

- [ ] **Step 4: Configurar EAS y generar el APK (con la persona usuaria)**

Create `mobile/eas.json`:
```json
{
  "cli": { "appVersionSource": "remote" },
  "build": {
    "preview": {
      "distribution": "internal",
      "environment": "preview",
      "android": { "buildType": "apk" }
    }
  }
}
```

La persona usuaria ejecuta en `mobile/` (inicio de sesión interactivo):
```bash
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_SUPABASE_URL --value "<URL>" --visibility plaintext
npx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "<CLAVE_ANON>" --visibility plaintext
npx eas-cli@latest build --platform android --profile preview
```
Expected: al terminar, EAS muestra un enlace y un QR para descargar el `.apk`. Instalarlo en cada teléfono de la familia (permitir "instalar apps de origen desconocido").

- [ ] **Step 5: Documentar cómo ejecutar el proyecto**

Agregar al final de `README.md`:
```markdown
## Cómo ejecutar

**Requisitos:** Node 20+, Docker y Deno (para las pruebas), Expo Go en un Android.

```bash
# Pruebas de base de datos (Supabase local)
npx supabase start && npx supabase test db

# Pruebas de la Edge Function
cd supabase/functions/analizar-foto && deno test

# App: copiar mobile/.env.example a mobile/.env con los datos del proyecto Supabase
cd mobile && npm install && npx jest && npx expo start   # escanear el QR con Expo Go
```

- Pruebas manuales: [docs/pruebas-manuales.md](docs/pruebas-manuales.md)
- APK: `npx eas-cli build --platform android --profile preview` (en `mobile/`)
```

- [ ] **Step 6: Recorrer la lista manual completa con el APK instalado**

Recorrer `docs/pruebas-manuales.md` en el teléfono con el APK. Cualquier punto que falle se corrige antes de cerrar la tarea.

- [ ] **Step 7: Commit**

```bash
cd /home/jonathan/Documents/Projects/FarmaSnap
git add supabase/functions/analizar-foto/eval.ts eval/esperado.json docs/pruebas-manuales.md mobile/eas.json README.md
git commit -m "chore: evaluación de la IA con fotos reales, pruebas manuales y build de APK con EAS"
```
