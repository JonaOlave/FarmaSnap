# Changelog

Cambios de FarmaSnap, del más nuevo al más antiguo.

## 2026-10-31

### Agregado
- **Foto a pantalla completa:** tocar la miniatura en el botiquín o la foto en la ficha la muestra a pantalla completa, sin recortes. Se cierra con ✕ o con "atrás".
- **Cambiar la foto al editar:** en "Editar" aparece "Cambiar foto" (o "Agregar foto" si no tiene), con cámara o galería. La nueva se guarda con "Guardar cambios" y "Cancelar" mantiene la anterior. No pasa por la IA ni gasta usos diarios.

### Cambiado
- La foto anterior se borra del almacenamiento solo después de guardar la nueva; si el guardado falla, se conserva la anterior.

## 2026-10-26

### Agregado
- **Caja en uso:** casilla "Hay una caja en uso" en la ficha. La cantidad muestra el detalle (por ejemplo "3 envases · 1 en uso, 2 nuevos"), también en el botiquín.
- Al restar y quedar 1 envase, la app pregunta si la caja que queda se marca en uso.

### Cambiado
- Restar un envase significa que se terminó la caja abierta: la marca se quita. Sin stock no puede haber caja en uso (lo asegura la base de datos).
- Migración `20261026000100_caja_en_uso.sql` (requiere `supabase db push`).

## 2026-10-20

### Agregado
- **Lectura de recetas impresas:** en "¿Lo tengo en casa?" el modo Receta lista cada medicamento recetado e indica si está en casa, si hay uno similar o equivalente, si está registrado sin stock o si no está registrado. No modifica el stock.
- Elegir la foto desde la galería, además de la cámara.
- Ícono nuevo: caja de medicamento con visor de escaneo.

### Corregido
- El botón "Registrar" queda sobre la barra de navegación del teléfono.
- Los principios activos se comparan sin la sal ("bromhidrato de fenoterol" = "fenoterol").
- Texto visible en los campos (incluida la contraseña) con el teléfono en modo oscuro.
- El permiso de cámara vuelve a solicitarse en el APK.
- Sin datos de las recetas en los registros del servidor.

## 2026-10-18 – 2026-10-20 · v1

### Agregado
- Inventario familiar compartido en Supabase, con inicio de sesión, tiempo real y modo sin conexión.
- Registro de medicamentos leyendo la caja con IA (Claude), con formulario editable y detección de duplicados.
- Búsqueda por texto tolerante a errores y búsqueda por foto con resultado verde, ámbar o rojo.
- Ficha del medicamento con edición, ajuste de envases y eliminación.
- Límite diario de uso de la IA y fotos en almacenamiento privado.
