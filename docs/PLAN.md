# Plan del proyecto: reservas + asistente de WhatsApp para clínicas de estética

> Documento para aprobar antes de escribir código. Versión 1 — 6 de octubre de 2026.
> Las palabras técnicas van explicadas entre paréntesis la primera vez que aparecen.

---

## 1. Cómo va a funcionar, en pocas palabras

- **Una sola aplicación web** (en Vercel) sirve a todas las clínicas. Cada clínica entra en su panel con su usuario.
- **Una sola base de datos** (Supabase, en Europa). Cada fila de datos lleva la etiqueta de su clínica, y la propia base de datos impide que una clínica vea lo de otra (eso es la *RLS*, "seguridad por filas": aunque hubiera un fallo en la pantalla, la base de datos no entrega datos ajenos).
- **Las citas no se pueden solapar** porque lo impide una regla de la base de datos, no la pantalla. Si dos personas intentan coger el mismo hueco en el mismo segundo, una lo consigue y a la otra se le dice "ese hueco se acaba de ocupar".
- **El asistente de WhatsApp** recibe los mensajes de Meta, consulta los datos de esa clínica y contesta usando Claude (la IA de Anthropic). Para reservar usa exactamente las mismas reglas que el panel y la web.
- **Las claves** (de Supabase, Meta, Anthropic) van en variables de entorno, nunca en el código.

---

## 2. Fase 0 — Preparación (antes de la fase a)

Lo he comprobado en tu ordenador:

| Herramienta | Estado | Para qué sirve | Coste |
|---|---|---|---|
| Node.js | ✅ instalado (v24) | Ejecutar la aplicación | Gratis |
| Git | ❌ no instalado | Guardar versiones del código y subirlo a GitHub/Vercel | Gratis |
| Docker Desktop | ❌ no instalado | Tener una copia de Supabase en tu ordenador para desarrollar y pasar las pruebas sin tocar datos reales | Gratis para empresas pequeñas (< 250 empleados y < 10 M€ facturación) |

Cuentas (te avisaré en el momento en que haga falta cada una; **ninguna la creo yo**):

| Servicio | Cuándo hace falta | Coste aproximado (compruébalo, los precios cambian) |
|---|---|---|
| GitHub (repositorio privado) | Para desplegar, final de la fase a | Gratis |
| Supabase, región UE (Fráncfort) | Para desplegar, final de la fase a | Gratis para probar. **Plan Pro (~25 $/mes) antes de la primera clínica real**: el gratuito se pausa si no hay uso y no tiene copias de seguridad |
| Vercel | Para desplegar, final de la fase a | El plan gratuito **no permite uso comercial**. **Plan Pro (~20 $/mes) antes de cobrar a la primera clínica** |
| Anthropic (API de Claude) | Fase c | Pago por uso. Ver apartado 6 |
| Meta WhatsApp Cloud API | Fase c | Ya la tienes. Meta cobra los mensajes de plantilla |

**Mi propuesta:** desarrollar las fases a y b enteras en tu ordenador con Docker (sin pagar nada) y solo crear las cuentas de pago cuando vayas a enseñarlo o venderlo.

---

## 3. Fases

Al final de cada fase: pruebas automáticas, una lista de cosas para que pruebes tú a mano, y me paro hasta que me digas que sigamos.

### Fase (a) — Multi-clínica, configuración y agenda

**Qué se construye**
1. Proyecto Next.js + TypeScript, base de datos completa (todas las tablas del apartado 4, aunque algunas se usen en fases posteriores) y reglas de seguridad por filas.
2. Inicio de sesión (email + contraseña o enlace mágico) y los tres roles: superadmin, admin de clínica, profesional.
3. **Panel de superadmin** (tú): dar de alta clínicas, invitar a su admin, activar/desactivar clínicas. Una clínica desactivada no puede reservar, no recibe respuestas del asistente y no envía mensajes.
4. **Configuración de la clínica**: datos, horario semanal (con turno partido), festivos y cierres, zona horaria (península o Canarias), profesionales con su horario y ausencias, cabinas, tratamientos con toda su información (incluidas preguntas frecuentes).
5. **Agenda**: vista diaria y semanal, por profesional y por cabina. Crear, mover y cancelar citas. Estados: pendiente, confirmada, cancelada, no presentada, completada.
6. **Ficha de clienta**: datos, historial de citas, *notas para el asistente* y *notas clínicas* (separadas, ver memoria de clientas). Fusionar fichas duplicadas. Borrado (anonimización) por derecho de supresión.
7. Datos de ejemplo: **Clínica Demo Sevilla** con 3 profesionales, 2 cabinas, 8 tratamientos y clientas ficticias con historial (para enseñar la memoria del asistente en las demos).
8. README en español: arrancarlo, desplegarlo, dar de alta una clínica.

**Pruebas automáticas**
- No se pueden crear dos citas solapadas en la misma profesional, ni en la misma cabina (incluida la prueba de dos reservas exactamente a la vez).
- Una cita cancelada libera el hueco.
- No se puede reservar fuera del horario, en un festivo o durante una ausencia.
- Un usuario de la clínica A no puede leer, crear, cambiar ni borrar nada de la clínica B (probado tabla por tabla).
- Una profesional solo ve su agenda.
- Un visitante sin sesión no puede leer nada.
- Los teléfonos se guardan siempre en formato internacional (+34…).
- La anonimización borra los datos personales y mantiene las citas sin nombre.

### Fase (b) — Reserva desde la web

1. Página pública de reservas por clínica (por ejemplo `tudominio.com/r/clinica-demo-sevilla`).
2. Widget de una línea para pegar en la web de la clínica (un `<script>` que muestra la página de reservas dentro de la web).
3. Pasos: tratamiento → profesional (o "cualquiera") → día y hueco libre → nombre, teléfono, email → casilla obligatoria de política de privacidad.
4. Privacidad: escribir un teléfono **nunca** muestra datos de nadie. Si el teléfono ya existe, la cita se asocia a esa ficha sin cambiar su nombre ni su email, y si no coinciden se avisa a la clínica.
5. Protección contra reservas falsas: límite de reservas por teléfono y por conexión, y una trampa invisible para robots de spam.

**Pruebas automáticas:** los huecos ofrecidos son reales (horario, festivos, ausencias, citas existentes, cabina libre); reservar sin aceptar la privacidad falla; la página pública no devuelve datos de clientas; una clínica desactivada no acepta reservas.

### Fase (c) — Asistente de WhatsApp

1. Recepción de mensajes de Meta, comprobando la firma (para asegurarnos de que el mensaje viene de verdad de Meta) y sin procesar dos veces el mismo mensaje (Meta a veces los reenvía).
2. Se identifica la clínica por el número de WhatsApp que recibe el mensaje, y a la clienta por su teléfono.
3. El asistente (Claude) recibe:
   - las instrucciones de la clínica: tono, normas y el nombre "asistente virtual de [clínica]", sin usar nunca la palabra "bot";
   - la información de tratamientos y horarios de esa clínica;
   - si es una clienta conocida, un resumen mínimo: nombre, último tratamiento y fecha, sesiones hechas, profesional y franja habituales, y notas para el asistente. **Nunca las notas clínicas ni el email.**
4. Herramientas que puede usar el asistente (cada una hace una sola cosa y la comprueba la base de datos):
   - consultar información de un tratamiento;
   - consultar huecos libres;
   - reservar, mover o cancelar una cita de esa clienta;
   - registrar el nombre y el consentimiento de privacidad;
   - pasar la conversación a una persona;
   - avisar a la clínica de una pregunta sin respuesta, una queja o una petición de datos o de borrado.
5. Reglas: nada de diagnósticos; ante problemas de salud o contraindicaciones concretas, recomienda una valoración y ofrece cita. No inventa precios. Si la cita es para otra persona (teléfono compartido), crea una ficha aparte.
6. Registro del gasto de IA por clínica (para que sepas cuánto te cuesta cada clínica).

**Pruebas automáticas:** firma de Meta válida/inválida; mensajes repetidos; mensaje desde un número desconocido = clienta nueva; el resumen que recibe la IA **nunca** contiene notas clínicas ni datos de otra clienta; las herramientas no pueden tocar citas de otra clienta ni de otra clínica; con la conversación pausada el asistente no contesta.

**Pruebas de conversación** (con la IA de verdad; **cuestan dinero**, te pediré permiso antes): unas 20 conversaciones tipo (reservar, preguntar precio, preguntar algo que no está en la ficha, consulta de salud, queja, "¿eres un bot?", clienta conocida, petición de borrado…) para comprobar que responde bien.

### Fase (d) — Bandeja, recordatorios, importación e informe

1. **Bandeja**: todos los chats en tiempo real, escribir como clínica, pausar/reanudar el asistente en un chat, avisos pendientes.
2. **Plantillas de WhatsApp**: te preparo los textos (confirmación de reserva, recordatorio 24 h con botones Confirmar/Cancelar, cambio de cita, cancelación) para que los mandes a aprobar a Meta.
3. **Recordatorios automáticos**: un proceso que se ejecuta cada 15 minutos (con el programador de Supabase, gratis) y envía los recordatorios. La respuesta de la clienta actualiza la agenda.
4. **Contador de mensajes iniciados por la clínica** por mes, separando los que Meta cobra de los que no (según la ventana de 24 h), para que lo compares con la factura de Meta.
5. **Importar clientas desde CSV** (Booksy): subir archivo → vista previa → elegir qué columna es cada dato → normalizar teléfonos → detectar duplicados → importar. Informe de filas con error.
6. **Informe mensual** por clínica: conversaciones atendidas, clientas que repiten, citas reservadas por el asistente, citas reservadas fuera de horario, cancelaciones y no presentadas. Imprimible/PDF.
7. Panel de superadmin con el consumo de cada clínica (mensajes de Meta y gasto de IA).

**Pruebas automáticas:** no se envía dos veces el mismo recordatorio; "Cancelar" en el recordatorio cancela solo esa cita; la clínica demo **nunca** envía WhatsApp a números ficticios; la importación normaliza teléfonos y no duplica; las cifras del informe cuadran con datos de prueba conocidos.

---

## 4. Esquema de la base de datos

Nombres en español para que puedas leerlos en Supabase. Todas las tablas de datos de clínica llevan `clinica_id` y reglas de seguridad por filas.

### Clínicas y usuarios

**clinicas** — una fila por clínica cliente tuya
- nombre, `slug` (el trozo de la dirección web: `clinica-demo-sevilla`), dirección, teléfono, email
- zona_horaria (`Europe/Madrid` o `Atlantic/Canary`)
- activa (sí/no), es_demo (sí/no: si es demo, nunca envía WhatsApp salvo a números autorizados)
- whatsapp_phone_number_id (identificador de su número en Meta), whatsapp_numero_visible
- tono_asistente, instrucciones_extra_asistente, url_politica_privacidad
- intervalo_huecos_min (cada cuánto se ofrecen huecos, p. ej. 15), antelacion_minima_reserva_min, horas_minimas_cancelacion

**superadmins** — quién eres tú (tu usuario)

**miembros** — quién trabaja en cada clínica
- usuario, clínica, rol (`admin` o `profesional`), profesional asociada (si el rol es profesional)

### Configuración

**profesionales** — nombre, color en la agenda, activa

**horarios_clinica** — día de la semana, hora inicio, hora fin (varias filas por día = turno partido)

**cierres_clinica** — fecha inicio, fecha fin, motivo (festivos, vacaciones)

**horarios_profesional** — igual que el de la clínica, por profesional

**ausencias_profesional** — desde, hasta, motivo

**cabinas** — nombre, activa

**tratamientos** — nombre, descripción, duración (min), precio, "precio desde" (sí/no), preparación previa, cuidados posteriores, nº de sesiones recomendado, contraindicaciones generales, preguntas frecuentes (lista de pregunta/respuesta), activo, reservable online (sí/no)

**tratamiento_profesionales** — qué profesionales hacen cada tratamiento

**tratamiento_cabinas** — en qué cabinas se puede hacer (si no tiene ninguna, no necesita cabina)

### Clientas y citas

**clientas**
- nombre, teléfono (formato +34…; **único por clínica**), email
- notas_asistente (preferencias, sin datos de salud; las usa el asistente)
- consentimiento_privacidad_fecha y por dónde (web, WhatsApp, panel, importación)
- origen (web, WhatsApp, panel, importación)
- contacto_principal_id (si se reservó desde el teléfono de otra persona: madre/hija)
- anonimizada_fecha (si se ejercieron los derechos de supresión)

**notas_clinicas** — tabla aparte a propósito: texto, quién la editó y cuándo. **El código del asistente no tiene acceso a esta tabla.**

**citas**
- clienta, tratamiento, profesional, cabina (opcional), inicio, fin
- estado (`pendiente`, `confirmada`, `cancelada`, `no_presentada`, `completada`)
- origen (`panel`, `web`, `asistente`, `importacion`)
- reservada_fuera_de_horario (sí/no, para el informe)
- cancelada_fecha, cancelada_por (clienta, clínica, asistente)
- recordatorio_enviado_fecha, confirmada_fecha
- **Regla anti-solapamiento:** la base de datos rechaza cualquier cita que se cruce con otra no cancelada de la misma profesional o de la misma cabina.

### WhatsApp y asistente

**conversaciones** — un chat por teléfono y clínica: clienta (si se conoce), teléfono, modo (`asistente` o `persona`), fecha del último mensaje de la clienta (para la ventana de 24 h de Meta), no leídos

**mensajes** — conversación, entrante/saliente, autor (clienta, asistente, personal), texto, tipo (texto, plantilla, botón), plantilla usada, identificador de Meta (para no procesar dos veces), estado de entrega, iniciado por la clínica (sí/no), dentro de la ventana de 24 h (sí/no)

**avisos** — lo que la clínica tiene que atender: tipo (pide persona, queja, pregunta sin respuesta, datos que no coinciden, petición de borrado, petición de acceso a datos), conversación, clienta, resuelto (fecha y quién)

**solicitudes_rgpd** — tipo (supresión, acceso), por dónde llegó, fecha de petición, fecha de resolución y quién la resolvió. Queda la constancia aunque la clienta se anonimice.

**uso_ia** — por cada respuesta del asistente: clínica, conversación, modelo, tokens consumidos (para calcular el coste)

**importaciones** — archivo, filas importadas, filas con error y por qué

### Funciones de la base de datos (reglas que viven dentro de Supabase)
- `huecos_libres(...)`: calcula los huecos reales.
- `reservar_cita(...)`: comprueba horario, festivos y ausencias, elige profesional/cabina si es "cualquiera" y reserva.
- `contexto_clienta_asistente(...)`: devuelve solo el resumen permitido para la IA.
- `anonimizar_clienta(...)`, `fusionar_clientas(...)`, `informe_mensual(...)`.

### Quién ve qué (seguridad por filas)

| | Superadmin | Admin de clínica | Profesional | Visitante web |
|---|---|---|---|---|
| Clínicas | Todas | La suya | La suya (solo lectura) | Nada directo* |
| Configuración y tratamientos | Todo | Edita la suya | Lee la suya | Nada directo* |
| Citas | Todas | Las de su clínica | **Solo las suyas** | Nada |
| Clientas | Todas | Las de su clínica | Solo las que tienen cita con ella | Nada |
| Notas clínicas | Todas | Las de su clínica | Las de sus clientas | Nada |
| Conversaciones e informe | Todo | Los de su clínica | No | Nada |

\* La página pública de reservas pasa por el servidor, que solo devuelve tratamientos, profesionales y huecos libres de clínicas activas.

---

## 5. Decisiones por defecto que he tomado (dime si quieres cambiar alguna)

1. Las reservas online y del asistente entran como **pendiente** y pasan a **confirmada** cuando la clienta confirma el recordatorio o la clínica la confirma a mano.
2. Las profesionales **sí** ven las notas clínicas de sus clientas (las necesitan para trabajar), pero **no** ven la bandeja de WhatsApp ni el informe.
3. La clínica demo nunca envía WhatsApp a sus clientas ficticias (podrían ser números reales de alguien).
4. El historial que usa el asistente es el de la clínica: si una clienta va a dos clínicas tuyas, son dos fichas independientes y ninguna ve la otra.

---

## 6. Coste de la IA (para decidir en la fase c, no ahora)

Precios oficiales de Anthropic por millón de *tokens* (un token ≈ ¾ de palabra):

| Modelo | Entrada | Salida | Estimación por conversación de reserva* |
|---|---|---|---|
| Claude Opus 5.5 (el más capaz de uso general) | 4 $ | 20 $ | ~0,10 – 0,25 $ |
| Claude Sonnet 5.5 (más barato) | 2 $ | 10 $ | ~0,05 – 0,12 $ |

\* Estimación orientativa para una conversación de unos 6 mensajes con consulta de huecos y reserva. La parte fija (instrucciones y tratamientos) se reutiliza entre mensajes y sale mucho más barata (caché). Con 300 conversaciones al mes, una clínica costaría aproximadamente entre 15 y 75 $/mes de IA según el modelo.

**Propuesta:** el modelo se elige con una variable de configuración (cambiarlo es inmediato). Empezamos con **Opus 5.5** y en la fase c medimos el coste real con las conversaciones de prueba. Si Sonnet 5.5 responde igual de bien, tú decides si cambiar.

---

## 7. Lo que necesito que me confirmes

1. ¿Apruebas el plan y el esquema?
2. **WhatsApp:** ¿cada clínica tendrá su propio número de WhatsApp? (Es lo que recomiendo y lo que asume este esquema.)
3. **Herramientas:** ¿instalamos Git y Docker Desktop en tu ordenador para trabajar en local sin coste? Te guío paso a paso.
4. ¿Algún cambio en las decisiones por defecto del apartado 5?
