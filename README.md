# BRITHIDA — web gastronómica MVP

Web responsive y mobile-first para un emprendimiento gastronómico de San Juan.

## Incluye

- Landing de marca con hero, promociones, productos destacados, delivery y contacto.
- Menú filtrable por categorías con precios en pesos argentinos.
- Carrito persistente en `localStorage`, cantidades, subtotal y checkout.
- Formulario de cliente y mensaje organizado para WhatsApp.
- Imágenes visuales de demostración con etiqueta `IMAGEN DEMO`, listas para reemplazar.
- SEO básico, accesibilidad inicial y responsive sin dependencias de backend.

## Configuración rápida

El panel está separado en `admin.html`. En Windows podés ejecutar `start.ps1`, ingresar tu contraseña y abrir los enlaces que muestra. Desde el panel podés editar WhatsApp, redes, dirección del local, horarios, delivery, retiro, nombres, categorías, precios, promociones e imágenes reales. Los cambios quedan guardados en el servidor y se reflejan para todos.

## Limitaciones actuales

El servidor usa un archivo JSON y autenticación por sesión para este MVP. Definí una contraseña inicial de al menos 8 caracteres, por ejemplo en PowerShell: `$env:BRITHIDA_ADMIN_PASSWORD="tu-contraseña-segura"; node server.mjs`. Luego podés cambiarla desde el panel. Para publicar en internet necesitás hosting Node.js/HTTPS; el WhatsApp configurado recibe las notificaciones de cada pedido.

## Publicación con `brithida.com.ar`

Se incluye `render.yaml` para desplegar el servidor como un Web Service en Render. En Render hay que conectar el repositorio, cargar `BRITHIDA_ADMIN_PASSWORD` como secreto, crear el servicio y agregar `brithida.com.ar` como Custom Domain. Luego se configuran en NIC Argentina los DNS que indique Render. El servicio usa `/var/data` para conservar catálogo, imágenes y pedidos.

No publiques `data.json` ni la carpeta `uploads`: están excluidos por `.gitignore`. En el primer arranque, Render crea el catálogo inicial y toma la contraseña desde `BRITHIDA_ADMIN_PASSWORD`.
