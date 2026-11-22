# Publicar Nutrición Pura en Vercel

Vercel aloja el sitio y las tres rutas API de Flow. Supabase guarda los pedidos. La llave `SUPABASE_SERVICE_ROLE_KEY` solo se usa en el servidor de Vercel.

## Paso a paso

1. **Crea un proyecto de Supabase** o elige el proyecto en el que guardarás los pedidos. El archivo `supabase/migrations/20261120_flow_orders.sql` crea la tabla `flow_orders` y el mecanismo seguro para evitar enviar dos veces el evento de compra de Meta.
2. **Crea la tabla.** En Supabase abre **SQL Editor → New query**, pega el contenido de `supabase/migrations/20261120_flow_orders.sql` y ejecuta la consulta. No hace falta ejecutar la migración `20260820_nexo_commerce_core.sql` para que funcionen los pagos.
3. **Copia las credenciales de Supabase.** En **Project Settings → API** copia el Project URL y la llave `service_role`. No uses la llave `service_role` en el frontend ni la compartas; da acceso administrativo a los datos.
4. **Importa el repositorio en Vercel.** En Vercel selecciona **Add New → Project**, importa el repositorio y deja el Root Directory como `./`. La configuración de `vercel.json` compila el sitio y publica las rutas API.
5. **Haz un primer deployment** desde Vercel para que se asigne el dominio `*.vercel.app`. Todavía no pruebes el checkout.
6. **Añade variables en Vercel → Project Settings → Environment Variables** para el entorno Production. Si pruebas una URL de Preview, configura también esas variables para Preview; usa como `SITE_URL`, `FLOW_RETURN_URL`, `FLOW_CONFIRMATION_URL` y origen permitido la URL pública correspondiente a ese entorno.

   - `SUPABASE_URL`: Project URL de Supabase.
   - `SUPABASE_SERVICE_ROLE_KEY`: llave `service_role` de Supabase.
   - `FLOW_API_KEY`: API key de Flow.
   - `FLOW_SECRET_KEY`: secreto de firma de Flow.
   - `META_CAPI_ACCESS_TOKEN`: token de Meta Conversions API.
   - `SITE_URL`: origen del dominio público, sin ruta; por ejemplo `https://nutricionpura.cl`.
   - `FLOW_RETURN_URL`: URL completa de retorno; por ejemplo `https://www.nutricionpura.cl/api/flow/return`. Flow devuelve al cliente con un POST; esa ruta lo redirige a la tienda con el identificador del pago.
   - `FLOW_CONFIRMATION_URL`: URL completa `https://nutricionpura.cl/api/flow/confirmation`.
   - `ALLOWED_ORIGINS`: orígenes permitidos separados por comas; por ejemplo `https://nutricionpura.cl,https://www.nutricionpura.cl`.

   Los nombres y valores de Flow y Meta son credenciales secretas. Añádelas en Vercel directamente, no en archivos del repositorio, y selecciona los entornos que vayas a usar.
   Si todavía no tienes dominio propio, usa el dominio `*.vercel.app` asignado por Vercel y coloca ese origen en `SITE_URL`, `FLOW_RETURN_URL` y `ALLOWED_ORIGINS`.

   Para desarrollo local, copia `.env.example` a `.env.local` y completa las credenciales de Flow. No subas `.env.local` al repositorio.
7. **Vuelve a desplegar** desde Vercel para aplicar las variables.
8. **Configura Flow.** En el panel de Flow registra exactamente el valor de `FLOW_CONFIRMATION_URL` como URL de confirmación. Flow debe poder enviar notificaciones a esa dirección pública.
9. **Prueba antes de vender.** Usa credenciales sandbox de Flow y confirma pagos aprobados, rechazados y pendientes. Comprueba que `/api/flow/status` refleje el estado y que los pedidos aparezcan en Supabase. Cuando todo esté validado, cambia a credenciales de producción y vuelve a desplegar.

Los pedidos existentes en otro almacenamiento no se copian automáticamente a Supabase; expórtalos antes si necesitas conservarlos.

## Rutas de la aplicación

- `POST /api/flow/create`: valida los productos y crea un pago en Flow.
- `POST /api/flow/status`: consulta a Flow y devuelve el estado verificado.
- `POST /api/flow/confirmation`: recibe la notificación de Flow y actualiza Supabase.
- `POST /api/flow/return`: recibe al cliente cuando vuelve de Flow (pague o no) y lo redirige a la tienda para mostrar el estado del pago.

La aplicación nunca confía solo en el retorno del navegador: verifica el importe, la moneda y el número de pedido con Flow. La tabla de pedidos tiene RLS habilitado y no concede acceso a usuarios anónimos o autenticados; solo la API servidor usa la llave `service_role`.

## Opcional: desplegar por terminal

```sh
npx vercel login
npx vercel link
npx vercel --prod
```
