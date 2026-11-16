# Finanzas COP

Aplicación local-first para administrar ingresos, gastos, efectivo, tarjetas de crédito y deudas desde iPhone y Mac.

Consulta el alcance, las decisiones técnicas y los criterios de aceptación en [`PLAN.md`](./PLAN.md).

## Desarrollo local

Requisitos: Node.js 24 o posterior, npm y PostgreSQL 16 instalado en el Mac.

En macOS también puedes abrir **`Abrir Brújula.command`** con doble clic. El iniciador comprueba PostgreSQL, crea la base `brujula_finanzas` si no existe y ejecuta el API y la web. Deja abierta la ventana de Terminal mientras la uses. Cerrar esa ventana detiene la aplicación.

## Datos y sincronización

- PostgreSQL se ejecuta en el Mac; la API está disponible para la web mediante `/api`.
- En el primer acceso, crea tu propio usuario y contraseña (mínimo 12 caracteres); no hay una contraseña predeterminada.
- La contraseña se guarda como hash `scrypt`; la sesión usa una cookie `HttpOnly` y expira a los 30 días.
- Los movimientos nuevos se guardan primero en una copia local del navegador y se sincronizan con PostgreSQL cuando la API está disponible.
- El iPhone y el Mac deben usar la misma Wi-Fi y el Mac debe estar encendido para sincronizar.
- Fuera de esa red, el acceso agregado a inicio no garantiza abrir la app sin conexión; todavía falta empaquetar una app iOS nativa o distribuir una PWA por HTTPS.
- Esta versión tiene una sola cuenta propietaria. El acceso local usa HTTP en la Wi-Fi (sin TLS): utiliza una red privada y no reutilices una contraseña importante. No expongas la aplicación a internet.

El esquema inicial de PostgreSQL se define en `server/migrations/001_initial.sql` e incluye movimientos, cuentas, tarjetas, deudas, abonos, presupuestos y categorías. En esta etapa la interfaz escribe movimientos; las pantallas CRUD de tarjetas, deudas y presupuestos se completarán después.

## Despliegue gratuito en Vercel + Supabase

La aplicación se puede desplegar con la web estática en Vercel Hobby y PostgreSQL en Supabase Free. Para hacer el cambio hacen falta una cuenta en cada servicio. No vincules tarjeta ni habilites facturación si quieres mantener el gasto en $0. Supabase Free puede pausar proyectos inactivos; ningún proveedor garantiza el nivel gratuito para siempre.

1. Crea un proyecto Supabase Free y copia la cadena de conexión PostgreSQL desde **Connect** (usa SSL). No la publiques ni la envíes por chat.
2. En Supabase **SQL Editor**, ejecuta el contenido completo de `server/migrations/001_initial.sql` para crear las tablas.
3. Desde este Mac, ejecuta el asistente. Pega la contraseña nueva de PostgreSQL cuando la solicite; no se mostrará ni se envía por chat. El asistente construye la conexión segura al pooler de este proyecto. El script revisa todas las tablas destino y aborta sin copiar si encuentra filas; transfiere la cuenta y su hash de contraseña, además de los datos financieros. No transfiere sesiones, por seguridad. Después la guarda como variable sensible de producción en Vercel y despliega.

   ```bash
   npm run deploy:cloud
   ```

4. La API se sirve desde `api/index.js`; el frontend usa `/api` en el mismo dominio. Al abrir el dominio `*.vercel.app`, inicia sesión con el usuario y contraseña existentes; no vuelvas a crear la cuenta.
5. Conserva un respaldo local antes de retirar el Mac. El script no modifica ni elimina el PostgreSQL local.

Comprueba que la conexión de Supabase está configurada antes del primer deploy. La aplicación no ejecuta cambios de esquema automáticamente en cada petición: el SQL de migración se aplica una vez desde el editor de Supabase.

## Agregar al inicio del iPhone (misma Wi-Fi)

1. Inicia Brújula en el Mac y conecta el iPhone a la misma red Wi-Fi.
2. Abre en Safari la dirección local del Mac, por ejemplo `http://192.168.1.89:5173`.
3. Pulsa **Compartir → Agregar a pantalla de inicio** y confirma **Agregar**.
4. Si ya existía el acceso, elimínalo primero y vuelve a agregarlo para actualizar el ícono.

Este acceso depende de que el Mac mantenga el servidor encendido y ambos dispositivos sigan en la misma red. No es todavía una app iOS autónoma.

## Comprobaciones

```bash
npm test
npm run lint
npm run build
npm run format:check
```

La instalación nativa para iPhone y el acceso offline fiable después de cerrar la app se completarán en las siguientes fases del plan.
