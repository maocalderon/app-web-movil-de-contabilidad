# Plan verificable — Finanzas COP

**Estado:** En desarrollo  
**Fecha de inicio:** 13 de noviembre de 2026  
**Plataformas objetivo:** iPhone y Mac  
**Moneda:** peso colombiano (COP)

## 1. Objetivo

Crear una aplicación personal de finanzas que permita registrar y consultar ingresos, gastos, efectivo, tarjetas de crédito, deudas, pagos, presupuestos y recordatorios. Debe funcionar sin internet en el iPhone y en el Mac, adaptarse a ambas pantallas y sincronizar los cambios cuando los dispositivos vuelvan a encontrarse en la misma red local.

## 2. Decisiones confirmadas

- [x] El usuario principal utiliza iPhone y Mac.
- [x] La moneda inicial será COP, sin decimales en la interfaz.
- [x] El iPhone debe permitir registrar datos fuera de casa y sin internet.
- [x] Se manejarán efectivo y tarjetas de crédito.
- [x] La tarjeta inicial tendrá un saldo pendiente de **$800.000 COP**.
- [x] La fecha de pago de una tarjeta podrá cambiarse.
- [x] Se registrarán gastos, deudas y abonos.
- [x] Habrá presupuestos, movimientos recurrentes y recordatorios.
- [x] No será obligatorio comprar un dominio ni publicar los datos financieros en una web pública.

## 3. Solución técnica propuesta

Se construirá una aplicación **local-first** con interfaz web adaptable y base de datos PostgreSQL en el Mac:

- **Interfaz:** React + TypeScript + Vite.
- **Diseño:** responsive/mobile-first, usable en iPhone y Mac.
- **Instalación en iPhone:** contenedor nativo con Capacitor para que la aplicación y su base local funcionen sin conexión.
- **Base de datos principal:** PostgreSQL local en el Mac, con migraciones versionadas; importes guardados como enteros.
- **Modo sin conexión:** copia y cola local en el navegador del iPhone/Mac; sincronización con el API del Mac al volver a la red local.
- **Mac:** la misma interfaz, ejecutada localmente y empaquetada después de validar el MVP.
- **Gráficas:** biblioteca compatible con React, elegida durante la implementación según accesibilidad y tamaño final.
- **Sincronización:** API local entre iPhone y Mac cuando estén en la misma red; hay sincronización inicial de movimientos y cola de borrados.
- **Seguridad:** contraseña almacenada únicamente como hash seguro; bloqueo local y respaldo cifrado en una fase posterior.

> **Restricción real:** sin internet y estando lejos del Mac no puede existir sincronización inmediata. El iPhone seguirá funcionando y guardará sus cambios; la sincronización ocurrirá después, al volver a conectarse a la misma red local. Instalar en iPhone sin App Store requiere conectar inicialmente el dispositivo al Mac y usar las herramientas de Apple. La opción de distribución definitiva se decidirá después del MVP.

## 4. Alcance del MVP

### Acceso

- Crear el primer usuario desde la aplicación.
- Iniciar y cerrar sesión.
- Cambiar la contraseña.
- No incluir contraseñas predeterminadas ni escritas en el código.

### Cuentas y tarjetas

- Cuenta de efectivo.
- Una o más tarjetas de crédito.
- Cupo opcional, saldo pendiente, fecha de corte y fecha de pago editables.
- Saldo inicial de tarjeta configurable; dato inicial esperado: $800.000 COP.

### Movimientos

- Registrar ingresos, gastos, compras con tarjeta y abonos.
- Campos: valor, fecha, categoría, cuenta/tarjeta, descripción y notas opcionales.
- Editar y eliminar con confirmación.
- Filtrar por periodo, tipo, categoría y medio de pago.

### Deudas

- Registrar una deuda con acreedor, valor inicial, fecha y vencimiento opcional.
- Registrar abonos y consultar el saldo pendiente.
- Ver historial completo de pagos.

### Organización

- Categorías configurables.
- Presupuesto mensual por categoría.
- Movimientos recurrentes.
- Recordatorios locales de pagos y vencimientos.

### Panel y gráficas

- Totales del mes: ingresos, gastos y balance.
- Dinero disponible en efectivo.
- Deuda total y saldo de tarjetas.
- Gráfica de ingresos contra gastos por mes.
- Gráfica de gastos por categoría.
- Evolución de deudas y tarjetas.

### Respaldo

- Exportar todos los datos a un archivo.
- Importar un respaldo con validación y confirmación.
- La sincronización automática local se desarrollará después del respaldo manual.

## 5. Modelo de datos inicial

- `User`: nombre, identificador, hash de contraseña y fechas de auditoría.
- `Account`: efectivo u otra cuenta, nombre, saldo inicial y estado.
- `CreditCard`: nombre, cupo, saldo inicial, días de corte/pago y estado.
- `Category`: nombre, color, icono y tipo de movimiento.
- `Transaction`: tipo, importe COP, fecha, origen, categoría, descripción y recurrencia.
- `Debt`: acreedor, importe inicial, saldo, vencimiento y estado.
- `DebtPayment`: deuda, importe, fecha y nota.
- `Budget`: categoría, mes e importe límite.
- `Reminder`: concepto, fecha, repetición y estado.
- `SyncEvent`: dispositivo, entidad, operación, versión y fecha para sincronización.

Todos los registros usarán identificadores UUID y fechas de creación/modificación para facilitar una sincronización posterior sin duplicados.

## 6. Pantallas

1. Bienvenida y creación del usuario.
2. Inicio de sesión y desbloqueo.
3. Panel principal.
4. Nuevo movimiento.
5. Historial y filtros.
6. Cuentas y efectivo.
7. Tarjetas de crédito y abonos.
8. Deudas y detalle de pagos.
9. Presupuestos y recurrentes.
10. Reportes y gráficas.
11. Recordatorios.
12. Configuración, respaldo y sincronización.

## 7. Fases y criterios verificables

### Fase 0 — Base del proyecto

- [x] Crear repositorio y estructura React + TypeScript.
- [x] Configurar lint, comprobación de formato, pruebas unitarias y compilación.
- [x] Crear tema visual responsive con formato COP.

**Verificación:** instalación reproducible; lint, pruebas y build terminan sin errores.

### Fase 1 — Finanzas locales (en curso)

- [x] Crear base PostgreSQL local y migración inicial.
- [x] Implementar primer usuario y acceso con contraseña; contraseña hasheada con `scrypt` y sesión en PostgreSQL.
- [x] Implementar movimientos en web, API y persistencia PostgreSQL con copia local.
- [x] Implementar tarjeta de crédito con saldo de demostración, compras y abonos.

**Verificación parcial:** PostgreSQL conserva movimientos; caché local permite registrar durante una desconexión y sincroniza al reconectar. Hay un único usuario propietario y la API exige sesión para movimientos. Las tablas de cuentas, tarjetas, deudas, pagos, categorías y presupuestos ya están creadas; su CRUD multiusuario y HTTPS siguen pendientes.

### Fase 2 — Panel y organización

- [x] Construir panel y gráficas iniciales.
- [ ] Añadir deudas, presupuestos y recurrentes.
- [ ] Añadir filtros y búsqueda.

**Verificación:** los totales de cada gráfica coinciden con los movimientos usados como prueba.

### Fase 3 — iPhone sin conexión

- [ ] Integrar Capacitor y SQLite nativo.
- [ ] Adaptar navegación, áreas seguras y formularios al iPhone.
- [ ] Añadir recordatorios locales.
- [ ] Probar modo avión.

**Verificación:** en modo avión se puede abrir la app, iniciar sesión, crear un gasto y consultarlo después de reiniciar.

### Fase 4 — Respaldo y sincronización

- [ ] Exportar e importar un respaldo versionado.
- [ ] Identificar cada dispositivo.
- [x] Sincronizar movimientos por red local cuando el API del Mac está activo.
- [ ] Resolver conflictos sin perder registros.

**Verificación:** un movimiento creado sin conexión en iPhone aparece en Mac al sincronizar; repetir en sentido contrario y comprobar que no hay duplicados.

### Fase 5 — Seguridad y entrega

- [ ] Revisar almacenamiento de credenciales y datos sensibles.
- [ ] Añadir bloqueo automático y, si es viable, Face ID.
- [ ] Documentar instalación en Mac y iPhone.
- [ ] Crear respaldo de prueba y procedimiento de recuperación.

**Verificación:** una instalación limpia puede restaurar el respaldo y obtener los mismos saldos y movimientos.

## 8. Pruebas mínimas obligatorias

- Formato correcto de valores COP: `$ 800.000`.
- Ingreso menos gastos produce el balance esperado.
- Compra con tarjeta aumenta el saldo pendiente, no reduce el efectivo.
- Abono a tarjeta reduce tanto el efectivo como la deuda de la tarjeta.
- Un abono nunca deja una deuda negativa sin confirmación explícita.
- Cambio de fecha de pago conserva el historial.
- Presupuestos cambian de estado según porcentaje consumido.
- Datos disponibles tras reinicio y en modo avión.
- Exportación/importación conserva cantidades, fechas y relaciones.
- Sincronización repetida es idempotente y no duplica movimientos.

## 9. Fuera del MVP

- Conexiones automáticas con bancos colombianos.
- Pagos bancarios desde la aplicación.
- Sincronización instantánea cuando los dispositivos están separados y sin internet.
- Publicación pública o acceso desde navegador sin instalación.
- Contabilidad empresarial, facturación electrónica o declaración tributaria.

## 10. Pendientes de decisión

Estas decisiones no bloquean el inicio del MVP:

- Nombre definitivo y estilo visual de la aplicación.
- Si habrá un único usuario o varios perfiles compartiendo datos.
- Modelo y fechas exactas de la primera tarjeta.
- Método definitivo de distribución a otros iPhone.
- Si se desea sincronización por iCloud como alternativa futura a la red local.

## 11. Definición de terminado

La primera versión estará terminada cuando permita instalarse en el iPhone, funcionar en modo avión, registrar y conservar movimientos, administrar la tarjeta con saldo inicial de $800.000 COP, mostrar totales y gráficas correctas, crear un respaldo y sincronizarlo con el Mac sin duplicar datos.
