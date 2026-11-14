# Gastos

App web instalable (PWA) para llevar el balance de gastos e ingresos de un hogar.

- **Sin datos en el código.** Cada instalación empieza vacía.
- **Cifrado de extremo a extremo.** Los datos se cifran en el dispositivo (AES-256-GCM) con una clave derivada de la contraseña del hogar (PBKDF2, 600.000 iteraciones). El servidor solo guarda texto cifrado.
- **Dispositivo registrado.** La contraseña del hogar se escribe una vez en cada dispositivo. La clave queda guardada como *no extraíble* y opcionalmente protegida con Face ID.
- **PDF leído en el móvil.** El extracto no sale del dispositivo.
- **Hogares independientes.** Cada hogar tiene sus datos y su contraseña. Un amigo puede crear el suyo en la misma app sin ver nada de los demás.

## Estado
Publicada en https://l-rero.github.io/gastos/ y conectada al proyecto de Supabase «Gastos» (esquema instalado y aislamiento entre hogares comprobado).

## Puesta en marcha (para otra instalación)

### 1. Supabase (base de datos)
1. Crea un proyecto en supabase.com (región Europa).
2. Abre **SQL Editor → New query**, pega el contenido de `supabase/schema.sql` y pulsa **Run**.
3. En **Authentication → URL Configuration**, pon como *Site URL* la dirección de la app (paso 2), por ejemplo `https://USUARIO.github.io/gastos/`, y añádela también en *Redirect URLs*.
4. En **Project Settings → API**, copia la *Project URL* y la clave *anon public* en `config.js`.

### 2. GitHub Pages (alojamiento)
1. Sube esta carpeta a un repositorio (por ejemplo `gastos`).
2. En **Settings → Pages**, elige *Deploy from a branch*, rama `main` y carpeta `/ (root)`.
3. Activa la verificación en dos pasos en tu cuenta de GitHub: quien controle el repositorio controla el código de la app.

### 3. Instalar en el iPhone
Abre la dirección en **Safari** y pulsa **Compartir → Añadir a pantalla de inicio**.

## Pasar los datos del prototipo
En el artefacto de Claude, abre **Cuentas y categorías → Exportar datos**. Después, en la app, ve a **Ajustes → Importar copia** y elige ese archivo.

Las reglas personales del prototipo ya no están en el código. Tras importar, revisa en **Ajustes → Cuentas → Modificar**:
- qué cuentas no se muestran en el panel;
- la cantidad *reservada* de la cuenta cuyo saldo incluye ahorros apuntados en otra cuenta.

## Publicar cambios
Cambia `VERSION` en `sw.js` cada vez que publiques, para que los móviles descarguen la versión nueva.

## Seguridad: qué protege y qué no
| Protegido | No protegido |
|---|---|
| Datos ilegibles en el servidor, aunque haya una filtración | Un móvil desbloqueado con la app abierta (activa Face ID) |
| Cada hogar solo ve lo suyo (RLS y cifrado) | Olvidar la contraseña del hogar: los datos no se pueden recuperar |
| Los PDF no salen del dispositivo | Que alguien modifique el código publicado (protege tu cuenta de GitHub) |
