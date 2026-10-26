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

## Receta
- [ ] En la cámara de búsqueda, el selector Caja | Receta cambia la indicación y el marco.
- [ ] Receta "Recetas solicitadas" (Coritex forte, Fesema, Ibuprofeno forte) → lista los 3 y nada más.
- [ ] Receta con indicaciones largas (Budesonida, Berodual, Acemuk, Azitromicina) → lista los 4, sin "probióticos".
- [ ] Cada estado se ve con su color: En casa (verde), Similar (ámbar), Sin stock (rojo), No registrado (blanco).
- [ ] Una marca con principio deducido muestra "Según la IA contiene…".
- [ ] Tocar una fila con medicamento en casa abre su detalle.
- [ ] Tras buscar por receta, el stock de todos los medicamentos sigue igual.
- [ ] Una foto que no es receta → "No encontré medicamentos en la receta…".
- [ ] Receta desde "Galería" funciona igual que con la cámara.

## Detalle
- [ ] Editar datos y guardar; editar a un duplicado muestra "Ya existe".
- [ ] Eliminar con confirmación.

## Caja en uso
- [ ] En la ficha, marcar "Hay una caja en uso": con 3 envases se lee "1 en uso, 2 nuevos" y en la lista "3 envases · 1 en uso, 2 nuevos".
- [ ] Con una caja en uso, "−" baja un envase y quita la marca (se terminó la caja abierta).
- [ ] Al pasar de 2 a 1 envase (desde la ficha o la lista) pregunta si se marca en uso; "Sí, en uso" la marca y "No" la deja nueva.
- [ ] "+" no cambia la marca; al llegar a 0 la casilla desaparece.
- [ ] La marca se ve en el otro teléfono sin recargar.

## Familia y conexión
- [ ] Un cambio en un teléfono aparece en otro sin recargar.
- [ ] Modo avión: aviso "Sin conexión · datos de hace…", la lista y la búsqueda por texto funcionan, y los botones de cambio quedan deshabilitados.
- [ ] Al volver la conexión, el aviso desaparece y la lista se actualiza.
