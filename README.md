# e. agencia · landing

Página de una sola pantalla para **e. agencia** (comunicación visual y RR.SS).
Es HTML, CSS y JavaScript comunes: no hay que instalar nada para verla ni para editarla.

## Archivos

| Archivo | Qué tiene |
|---|---|
| `index.html` | La página publicada (versión E): textos, estilos y animaciones, todo en un archivo. |
| `pruebas/e-bg.js` | El fondo líquido en movimiento que usa `index.html`. |
| `assets/` | Logo, fotos y el contenido de los servicios que baja de Drive. |
| `vieja.html` | La landing anterior, guardada por si hace falta (usa `styles.css`, `script.js` y `hero-bg.js`). |

## Cómo cambiar algo sin saber programar

Pedíselo a Claude (o a otra IA) con el repo abierto. Ejemplos que funcionan bien:

- "Cambiá el teléfono de contacto por +54 9 11 ..."
- "Agregá un servicio que diga *Diseño web*"
- "Reemplazá la foto de Cómo trabajamos por `assets/equipo.jpg`"
- "Poné el link real de Instagram: https://instagram.com/..."

Para hacerlo desde cualquier compu sin instalar nada: entrar a **claude.ai/code**,
conectar este repo de GitHub y pedir el cambio. Al terminar, Vercel publica solo.

Si querés tocarlo a mano: los textos están en `index.html` entre etiquetas
(`<p>...</p>`, `<h2>...</h2>`); cambiá solo lo que está adentro.

## Ver la página en tu compu

Abrí `index.html` con doble click. Las fuentes y las fotos de muestra necesitan internet.

## Contenido desde Drive (prueba E)

Las fotos y videos de cada servicio, y la foto de "Quiénes somos", salen de la carpeta de Drive
**"Agencia E - web"**, una subcarpeta por servicio. Para cambiar el contenido de la web **solo hay que
subir o borrar archivos en Drive**: todos los días a las 6:00 un robot (GitHub Actions,
`.github/workflows/sync-drive.yml`) baja lo nuevo, lo achica (fotos de hasta 1400 px, videos 720p sin audio
y de hasta 20 s), actualiza `assets/servicios/` y Vercel publica solo. Para no esperar: en GitHub, pestaña
**Actions > Sincronizar contenido desde Drive > Run workflow**.

- Cada servicio muestra hasta 12 piezas, las más nuevas primero.
- Para elegir el orden, poné un número y un guion al principio del nombre en Drive: `01-lanzamiento.mov`, `02-foto.jpg`.
- La grilla se arma sola según el formato de cada pieza (vertical, foto, apaisada) y cambia en cada servicio.
- Los PDF y otros archivos que no son fotos ni videos se ignoran.
- Los textos de cada servicio siguen en `index.html`.

Para correrlo a mano desde una copia local de las carpetas: `python tools/sync_servicios.py --local CARPETA`.

**Configuración (una sola vez):** el robot necesita una cuenta de servicio de Google con acceso de lectura a
la carpeta, y su clave JSON cargada en GitHub como secreto `GDRIVE_SA_KEY`
(Settings > Secrets and variables > Actions).

## Pendientes

- [ ] Link real de LinkedIn en `index.html` (Instagram y TikTok ya están)
- [ ] Cuenta de servicio de Google y secreto `GDRIVE_SA_KEY` para que la sincronización con Drive corra sola
- [ ] Dominio propio en Vercel
