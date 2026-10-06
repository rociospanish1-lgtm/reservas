# Fase (a): qué probar a mano

Antes, sigue el apartado 1 del [README](../README.md) para arrancar la aplicación con la demo.
Marca cada punto cuando lo hayas comprobado. Si algo no funciona como esperas, apúntalo y me lo cuentas.

## Superadmin (superadmin@demo.local)

- [ ] Al entrar llegas a **Clínicas** y ves la Clínica Demo Sevilla marcada como "Demo".
- [ ] Creas una clínica nueva con tu propio email como responsable. En http://localhost:54324 ves el email de invitación.
- [ ] Desde ese email creas la contraseña y entras: ves la clínica nueva **vacía**. No ves nada de la demo.
- [ ] Desactivas la clínica nueva desde el superadmin. Al recargar con la otra cuenta, ya no puedes entrar.
- [ ] La vuelves a activar y puedes entrar otra vez.

## Configuración (admin@demo.local)

- [ ] **Clínica y horario**: cambias el horario del sábado, guardas, recargas y se mantiene.
- [ ] Añades un festivo de la semana que viene. En la agenda de ese día aparece "Cerrado" y todo en gris.
- [ ] **Profesionales**: añades una profesional nueva, le pones horario y tratamientos. Aparece en la agenda.
- [ ] Le pones a Marta una ausencia mañana por la tarde. En la agenda se ve rayado.
- [ ] **Tratamientos**: editas un precio y una pregunta frecuente; se guardan bien.
- [ ] **Equipo**: invitas a un email inventado como profesional de Lucía. Aparece como "Invitación pendiente".

## Agenda (admin@demo.local)

- [ ] La vista de **día** muestra una columna por profesional, con las citas de la demo la semana que viene.
- [ ] La vista **semana** de Lucía muestra sus citas de los 7 días.
- [ ] **Por cabina**: ves la ocupación de la Cabina Láser y la Cabina Facial.
- [ ] Pulsas en un hueco blanco: se abre "Nueva cita" con el día, la hora y la profesional ya puestos.
- [ ] Creas una cita para una **clienta nueva**. Se crea la ficha y la cita aparece en la agenda.
- [ ] **Prueba clave**: intentas dar otra cita a la misma profesional a la misma hora. Sale un aviso y **no** se crea.
- [ ] **Prueba clave**: con dos profesionales distintas, intentas dos tratamientos de cabina facial a la misma hora. El segundo **no** se crea.
- [ ] Intentas una cita a las 22:00. Te avisa de que está fuera de horario. Si marcas "Permitir fuera de horario", sí se crea.
- [ ] Mueves una cita a otra hora libre. Se mueve. La mueves encima de otra cita: no te deja.
- [ ] Cancelas una cita. Desaparece de la agenda (sale con "Ver canceladas") y el hueco queda libre.
- [ ] Marcas una cita como completada y otra como no presentada.

## Clientas (admin@demo.local)

- [ ] Buscas "ana" y "600 000 101": las dos búsquedas encuentran a Ana García.
- [ ] En la ficha de Ana ves su historial (3 sesiones de láser), sus notas para el asistente y sus notas clínicas.
- [ ] Creas una clienta con teléfono "612 34 56 78" y otra con "+34612345678". La segunda da error de teléfono repetido.
- [ ] Creas una ficha duplicada de Pilar (sin teléfono), le das una cita y la **fusionas** desde la ficha original. La cita pasa a la ficha buena.
- [ ] **Borras los datos** de Nuria (escribiendo BORRAR). La ficha pasa a "Clienta eliminada", su cita futura se cancela y ya no sale en la lista.

## Profesional (lucia@demo.local)

- [ ] Solo ves tu columna en la agenda. No aparece "Configuración".
- [ ] En **Clientas** solo ves a las clientas que atiendes tú.
- [ ] Puedes marcar tus citas como completadas, pero no ves los botones de mover ni de cancelar.
- [ ] Si pegas en el navegador la dirección de una cita de Marta, sale "No encontrado".

## En el móvil

- [ ] Abres la agenda en el móvil (o haces la ventana estrecha): se puede desplazar hacia los lados y se lee bien.
