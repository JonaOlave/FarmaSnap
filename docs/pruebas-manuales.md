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
