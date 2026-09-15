# e. agencia · landing

Página de una sola pantalla para **e. agencia** (comunicación visual y RR.SS).
Es HTML, CSS y JavaScript comunes: no hay que instalar nada para verla ni para editarla.

## Archivos

| Archivo | Qué tiene |
|---|---|
| `index.html` | Todos los textos de la página, sección por sección. |
| `styles.css` | Colores (arriba de todo), tipografía, tamaños, responsive. |
| `script.js` | Menú del celular, animaciones al scrollear, sección activa. |
| `assets/` | Logo y fotos. |

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

## Contenido de los servicios (prueba E)

Las fotos y videos de cada servicio están en `assets/servicios/<servicio>/`, bajados de la
carpeta de Drive "Agencia E - web" y achicados para web (imágenes ≤ 1400 px, videos 720p
sin audio y de hasta 20 s). Para sumar uno: copiarlo ahí y agregar un `<figure>` en `pruebas/e.html`.

## Pendientes

- [ ] Fotos de merchandising (no había en Drive; quedan fotos de muestra marcadas con `PLACEHOLDER`)
- [ ] Fotos reales en `index.html` (hoy hay fotos de muestra de Unsplash marcadas con `PLACEHOLDER`)
- [ ] Links reales de Instagram, WhatsApp y correo (buscá `href="#"` en `index.html`)
- [ ] Dominio propio en Vercel
