# Reservas

Agenda online y asistente de WhatsApp con IA para clínicas de estética: reservas, recordatorios y atención a clientas sin comisiones. Una sola instalación sirve a varias clínicas, y cada clínica solo ve sus datos.

- Plan por fases y esquema de la base de datos: [docs/PLAN.md](docs/PLAN.md)
- Qué probar a mano al acabar la fase (a): [docs/PRUEBAS-FASE-A.md](docs/PRUEBAS-FASE-A.md)

**Estado:** fase (a) terminada: multi-clínica, configuración, agenda y fichas de clientas.

---

## 1. Arrancarlo en tu ordenador

### Lo que necesitas instalado (una sola vez)

| Programa | Para qué |
|---|---|
| Node.js 20.9 o superior | Ejecutar la aplicación |
| Git | Guardar versiones y subirlas a GitHub |
| Docker Desktop (con WSL) | Tener una copia de Supabase en tu ordenador |

### Pasos

Abre una terminal en la carpeta del proyecto y ejecuta, en orden:

```bash
npm install
```

Instala las librerías (solo la primera vez o cuando cambien).

```bash
npm run db:iniciar
```

Arranca la base de datos local en Docker. La primera vez tarda unos minutos porque descarga lo necesario. **Docker Desktop tiene que estar abierto.**

```bash
npm run db:reiniciar
```

Crea las tablas y carga la **Clínica Demo Sevilla**. Ojo: borra todo lo que hubiera en la base de datos local.

```bash
npm run entorno:local
```

Crea el archivo `.env.local` con las claves de la base de datos local. Este archivo nunca se sube a GitHub.

```bash
npm run demo:usuarios
```

Crea los usuarios de la demo (ver abajo).

```bash
npm run dev
```

Arranca la aplicación. Ábrela en http://localhost:3000

### Usuarios de la demo (solo en tu ordenador)

La contraseña de todos es la que pone `DEMO_CONTRASENA` en tu `.env.local`.

| Email | Qué ve |
|---|---|
| superadmin@demo.local | Todas las clínicas (eres tú) |
| admin@demo.local | Todo lo de la Clínica Demo Sevilla |
| lucia@demo.local, carmen@demo.local, marta@demo.local | Solo su agenda y sus clientas |

Los emails que envía la aplicación en local (invitaciones, cambio de contraseña) **no salen a internet**: se ven en http://localhost:54324. El panel de la base de datos local está en http://localhost:54323.

### Pruebas automáticas

Con la base de datos local en marcha:

```bash
npm test
```

Comprueban las reglas críticas: que nunca se solapan dos citas (ni con reservas simultáneas), que se respetan horarios, festivos y ausencias, y que cada clínica y cada profesional solo ven lo suyo.

Para apagar la base de datos local cuando termines:

```bash
npm run db:parar
```

---

## 2. Desplegarlo (ponerlo en internet)

> Esto tiene costes y pasos que no se pueden deshacer fácilmente: lo haremos juntas cuando toque.

1. **Supabase**: crea un proyecto en https://supabase.com eligiendo una **región de la UE** (por ejemplo, Frankfurt). Para clínicas reales usa el plan Pro (copias de seguridad).
2. **Subir el esquema** de la base de datos al proyecto en la nube (desde la carpeta del proyecto):

   ```bash
   npx supabase login
   ```

   ```bash
   npx supabase link
   ```

   ```bash
   npx supabase db push
   ```

   `db push` crea las tablas, pero **no** carga la clínica demo.
3. **Supabase → Authentication**:
   - *Sign In / Providers*: desactiva "Allow new users to sign up" (solo se entra por invitación).
   - *URL Configuration*: pon como *Site URL* la dirección de tu web (por ejemplo `https://tuapp.vercel.app`) y añádela también en *Redirect URLs* como `https://tuapp.vercel.app/**`.
   - *Emails → Templates*: copia el contenido de `supabase/templates/invitacion.html` en "Invite user" y el de `supabase/templates/recuperar.html` en "Reset password".
   - *Emails → SMTP*: configura un servicio de envío de emails propio. El de Supabase solo sirve para pruebas y envía muy pocos emails por hora.
4. **Vercel**: importa el repositorio de GitHub y añade estas variables de entorno (Settings → Environment Variables):

   | Variable | Dónde se encuentra |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API Keys → *publishable* |
   | `SUPABASE_SECRET_KEY` | Supabase → Project Settings → API Keys → *secret* (¡no la compartas nunca!) |
   | `NEXT_PUBLIC_SITE_URL` | La dirección de tu web en Vercel |

   **No** pongas `DEMO_CONTRASENA` en producción.
5. **Hacerte superadmin**: pon temporalmente en tu `.env.local` las claves de producción (URL, secret, site URL) y ejecuta:

   ```bash
   npm run superadmin -- tu@email.com
   ```

   Te llegará un email para crear tu contraseña. Después vuelve a dejar el `.env.local` con las claves locales (`npm run entorno:local`).

---

## 3. Dar de alta una clínica nueva

1. Entra con tu usuario de superadmin. Llegas a **Clínicas**.
2. En "Dar de alta una clínica" escribe el nombre, elige la zona horaria (península o Canarias) y el email de la persona responsable. Pulsa **Crear clínica**.
3. A esa persona le llega un email para crear su contraseña. Al entrar, verá su panel vacío.
4. La clínica (o tú, con "Abrir panel") rellena en **Configuración**:
   1. *Clínica y horario*: datos, horario de apertura y festivos.
   2. *Profesionales*: cada una con su horario y los tratamientos que hace.
   3. *Cabinas*: solo si algún tratamiento necesita una sala concreta.
   4. *Tratamientos*: duración, precio y toda la información que usará el asistente.
   5. *Equipo y accesos*: invitar a las profesionales para que vean su agenda.
5. Para cortar el servicio a una clínica (por ejemplo, si deja de pagar), pulsa **Desactivar**. Su equipo deja de poder entrar y no se aceptan reservas. Los datos no se borran y puedes reactivarla cuando quieras.

---

## 4. Cómo está organizado (para quien programe)

- `supabase/migrations/`: esquema de la base de datos, seguridad por filas (RLS) y funciones de reserva. **Las reglas importantes están aquí**, no en la pantalla:
  - restricciones `EXCLUDE` que impiden solapes por profesional y por cabina;
  - referencias compuestas `(id, clinica_id)` para que no se mezclen datos de clínicas;
  - `reservar_cita`, `huecos_libres`, `mover_cita`, `anonimizar_clienta` y `fusionar_clientas`.
- `supabase/seed.sql`: Clínica Demo Sevilla.
- `src/app/`: páginas (Next.js App Router). `admin/` es el superadmin; `clinica/[slug]/` es el panel de cada clínica.
- `src/lib/`: sesión y permisos, fechas y zonas horarias, teléfonos, errores.
- `tests/`: pruebas automáticas contra la base de datos local.
- Las notas clínicas están en una tabla aparte (`notas_clinicas`) que el asistente de IA nunca leerá.
