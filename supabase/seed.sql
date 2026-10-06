-- =============================================================================
-- Datos de ejemplo: "Clínica Demo Sevilla" (ficticia, para demos).
-- Se cargan solos con `npx supabase db reset` en tu ordenador.
--
-- Todo es inventado: nombres, teléfonos, precios y textos. La clínica está
-- marcada como demo (es_demo = true), así que nunca enviará WhatsApp a estas
-- clientas aunque se conecte un número.
--
-- Las fechas de las citas se calculan a partir de hoy, para que la demo
-- siempre tenga historial pasado y citas en los próximos días.
-- =============================================================================

do $$
declare
  v_clinica uuid := '00000000-0000-4000-8000-000000000001';
  -- Profesionales
  v_lucia  uuid := '00000000-0000-4000-8000-000000000101';
  v_carmen uuid := '00000000-0000-4000-8000-000000000102';
  v_marta  uuid := '00000000-0000-4000-8000-000000000103';
  -- Cabinas
  v_cab_laser  uuid := '00000000-0000-4000-8000-000000000201';
  v_cab_facial uuid := '00000000-0000-4000-8000-000000000202';
  -- Tratamientos
  v_limpieza   uuid := '00000000-0000-4000-8000-000000000301';
  v_express    uuid := '00000000-0000-4000-8000-000000000302';
  v_peeling    uuid := '00000000-0000-4000-8000-000000000303';
  v_radiofrec  uuid := '00000000-0000-4000-8000-000000000304';
  v_laser_axi  uuid := '00000000-0000-4000-8000-000000000305';
  v_laser_pie  uuid := '00000000-0000-4000-8000-000000000306';
  v_presoter   uuid := '00000000-0000-4000-8000-000000000307';
  v_manicura   uuid := '00000000-0000-4000-8000-000000000308';
  -- Clientas
  v_ana     uuid := '00000000-0000-4000-8000-000000000401';
  v_rocio   uuid := '00000000-0000-4000-8000-000000000402';
  v_pilar   uuid := '00000000-0000-4000-8000-000000000403';
  v_elena   uuid := '00000000-0000-4000-8000-000000000404';
  v_isabel  uuid := '00000000-0000-4000-8000-000000000405';
  v_lola    uuid := '00000000-0000-4000-8000-000000000406';
  v_nuria   uuid := '00000000-0000-4000-8000-000000000407';
  v_sofia   uuid := '00000000-0000-4000-8000-000000000408';

  v_tz text := 'Europe/Madrid';
  -- Lunes de esta semana, de la semana pasada, etc.
  v_lunes date := date_trunc('week', current_date)::date;
  v_dia int;
begin
  insert into public.clinicas (
    id, nombre, slug, direccion, telefono, email, zona_horaria, es_demo,
    tono_asistente, intervalo_huecos_min, antelacion_minima_reserva_min, horas_minimas_cancelacion
  ) values (
    v_clinica, 'Clínica Demo Sevilla', 'clinica-demo-sevilla',
    'Calle Ejemplo 12, 41001 Sevilla', '+34954000000', 'hola@clinicademo.example',
    v_tz, true,
    'Cercano y profesional, con un toque andaluz amable. Tutea a la clienta y usa frases cortas.',
    15, 60, 24
  );

  -- Horario: L-V 9:30-14:00 y 16:00-20:30; sábado 10:00-14:00
  for v_dia in 1..5 loop
    insert into public.horarios_clinica (clinica_id, dia_semana, hora_inicio, hora_fin) values
      (v_clinica, v_dia, '09:30', '14:00'),
      (v_clinica, v_dia, '16:00', '20:30');
  end loop;
  insert into public.horarios_clinica (clinica_id, dia_semana, hora_inicio, hora_fin)
  values (v_clinica, 6, '10:00', '14:00');

  -- Festivos de ejemplo
  insert into public.cierres_clinica (clinica_id, fecha_inicio, fecha_fin, motivo) values
    (v_clinica, '2026-12-08', '2026-12-08', 'Inmaculada Concepción'),
    (v_clinica, '2026-12-24', '2026-12-26', 'Navidad'),
    (v_clinica, '2027-01-01', '2027-01-01', 'Año Nuevo'),
    (v_clinica, '2027-01-06', '2027-01-06', 'Reyes'),
    (v_clinica, '2027-02-28', '2027-02-28', 'Día de Andalucía');

  -- Profesionales
  insert into public.profesionales (id, clinica_id, nombre, color, orden) values
    (v_lucia,  v_clinica, 'Lucía',  '#f472b6', 1),
    (v_carmen, v_clinica, 'Carmen', '#a78bfa', 2),
    (v_marta,  v_clinica, 'Marta',  '#34d399', 3);

  -- Lucía: mañanas L-V + sábado. Carmen: L-J mañana y tarde. Marta: tardes L-V.
  for v_dia in 1..5 loop
    insert into public.horarios_profesional (clinica_id, profesional_id, dia_semana, hora_inicio, hora_fin)
    values (v_clinica, v_lucia, v_dia, '09:30', '14:00'),
           (v_clinica, v_marta, v_dia, '16:00', '20:30');
  end loop;
  insert into public.horarios_profesional (clinica_id, profesional_id, dia_semana, hora_inicio, hora_fin)
  values (v_clinica, v_lucia, 6, '10:00', '14:00');
  for v_dia in 1..4 loop
    insert into public.horarios_profesional (clinica_id, profesional_id, dia_semana, hora_inicio, hora_fin)
    values (v_clinica, v_carmen, v_dia, '09:30', '14:00'),
           (v_clinica, v_carmen, v_dia, '16:00', '19:00');
  end loop;

  -- Cabinas
  insert into public.cabinas (id, clinica_id, nombre) values
    (v_cab_laser, v_clinica, 'Cabina Láser'),
    (v_cab_facial, v_clinica, 'Cabina Facial');

  -- Tratamientos
  insert into public.tratamientos (
    id, clinica_id, nombre, descripcion, duracion_min, precio, precio_desde, preparacion,
    cuidados_posteriores, sesiones_recomendadas, contraindicaciones, preguntas_frecuentes, orden
  ) values
  (v_limpieza, v_clinica, 'Limpieza facial profunda',
   'Limpieza completa con extracción, exfoliación, mascarilla según tipo de piel y masaje facial.',
   60, 55, false,
   'Ven con la cara sin maquillar si puedes. No te apliques ácidos ni retinol los 3 días anteriores.',
   'Evita el maquillaje durante 12 horas y usa protector solar los días siguientes.',
   null,
   'Herpes activo, heridas abiertas o quemaduras solares recientes en la zona.',
   '[{"pregunta":"¿Cada cuánto se recomienda?","respuesta":"Una vez al mes para mantener la piel limpia y equilibrada."},
     {"pregunta":"¿Me quedará la piel roja?","respuesta":"Puede quedar algo rosada un par de horas tras la extracción; es normal."}]',
   1),
  (v_express, v_clinica, 'Higiene facial express',
   'Limpieza rápida con exfoliación suave e hidratación. Ideal para mantener entre limpiezas profundas.',
   30, 30, false,
   'Ninguna preparación especial.',
   'Hidratación habitual y protector solar.',
   null,
   'Herpes activo o heridas en la zona.',
   '[{"pregunta":"¿Lleva extracción?","respuesta":"No, para eso está la limpieza facial profunda."},
     {"pregunta":"¿Puedo maquillarme después?","respuesta":"Sí, aunque es mejor esperar unas horas."}]',
   2),
  (v_peeling, v_clinica, 'Peeling químico',
   'Renovación de la piel con ácidos para mejorar manchas, textura y marcas de acné.',
   45, 70, false,
   'Suspende el retinol y los exfoliantes 5 días antes. No tomes el sol la semana anterior.',
   'Protector solar 50+ a diario, no exponerse al sol 2 semanas y no arrancar la piel que se descame.',
   4,
   'Embarazo y lactancia, piel bronceada, tratamientos con isotretinoína en los últimos 6 meses, herpes activo.',
   '[{"pregunta":"¿Cuántas sesiones necesito?","respuesta":"Normalmente 4 sesiones separadas 2-3 semanas, según la valoración."},
     {"pregunta":"¿Se puede hacer en verano?","respuesta":"Recomendamos hacerlo de otoño a primavera por la exposición al sol."}]',
   3),
  (v_radiofrec, v_clinica, 'Radiofrecuencia facial',
   'Tratamiento con calor que estimula el colágeno para mejorar la firmeza y la flacidez.',
   50, 65, false,
   'Ven sin maquillaje y sin cremas en la zona.',
   'Bebe agua e hidrata bien la piel los días siguientes.',
   6,
   'Embarazo, marcapasos, implantes metálicos en la zona, cáncer activo.',
   '[{"pregunta":"¿Duele?","respuesta":"No, se nota un calor agradable."},
     {"pregunta":"¿Cuándo se ven resultados?","respuesta":"Desde la primera sesión hay efecto tensor; el resultado completo llega tras el ciclo."}]',
   4),
  (v_laser_axi, v_clinica, 'Depilación láser diodo · axilas',
   'Depilación con láser de diodo para reducir el vello de forma duradera.',
   20, 35, false,
   'Rasura la zona 24 horas antes. No uses cera ni pinzas el mes anterior. No tomes el sol 15 días antes.',
   'Evita sol, sauna y desodorante con alcohol 48 horas. Protector solar si la zona se expone.',
   8,
   'Embarazo, piel bronceada, medicación fotosensibilizante, lesiones en la zona.',
   '[{"pregunta":"¿Cuántas sesiones hacen falta?","respuesta":"Entre 6 y 8 sesiones de media, según el tipo de vello."},
     {"pregunta":"¿Cada cuánto son las sesiones?","respuesta":"En axilas, cada 4-6 semanas aproximadamente."}]',
   5),
  (v_laser_pie, v_clinica, 'Depilación láser diodo · piernas completas',
   'Depilación con láser de diodo de piernas completas.',
   60, 120, false,
   'Rasura la zona 24 horas antes. No uses cera ni pinzas el mes anterior. No tomes el sol 15 días antes.',
   'Evita sol, sauna y piscina 48 horas. Hidratación sin alcohol.',
   8,
   'Embarazo, piel bronceada, medicación fotosensibilizante, varices o lesiones en la zona.',
   '[{"pregunta":"¿Duele?","respuesta":"Se nota un pequeño pinchazo de calor; el equipo lleva enfriamiento."},
     {"pregunta":"¿Hacéis bonos?","respuesta":"Pregúntanos en la clínica por los bonos disponibles."}]',
   6),
  (v_presoter, v_clinica, 'Presoterapia',
   'Drenaje con presión de aire que mejora la circulación y la retención de líquidos.',
   45, 30, false,
   'Ven con ropa cómoda.',
   'Bebe agua abundante después de la sesión.',
   10,
   'Trombosis o flebitis, insuficiencia cardíaca, embarazo, heridas en piernas.',
   '[{"pregunta":"¿Cuántas sesiones se recomiendan?","respuesta":"Un ciclo de unas 10 sesiones, 2 por semana."},
     {"pregunta":"¿Es molesto?","respuesta":"No, la presión es progresiva y relajante."}]',
   7),
  (v_manicura, v_clinica, 'Manicura semipermanente',
   'Limado, cutículas y esmaltado semipermanente con el color que elijas.',
   45, 22, false,
   'Ven sin esmalte o avísanos para retirarlo (tiene un pequeño suplemento en la clínica).',
   'Usa guantes para fregar y aceite de cutículas a diario.',
   null,
   'Infecciones o heridas en las uñas o alrededor.',
   '[{"pregunta":"¿Cuánto dura?","respuesta":"Entre 2 y 3 semanas, según el crecimiento de la uña."},
     {"pregunta":"¿Hacéis también pies?","respuesta":"Ahora mismo solo manos."}]',
   8);

  -- Qué hace cada profesional
  insert into public.tratamiento_profesionales (clinica_id, tratamiento_id, profesional_id) values
    (v_clinica, v_limpieza, v_lucia), (v_clinica, v_limpieza, v_carmen),
    (v_clinica, v_express, v_lucia), (v_clinica, v_express, v_carmen),
    (v_clinica, v_peeling, v_carmen),
    (v_clinica, v_radiofrec, v_carmen), (v_clinica, v_radiofrec, v_marta),
    (v_clinica, v_laser_axi, v_marta), (v_clinica, v_laser_axi, v_lucia),
    (v_clinica, v_laser_pie, v_marta),
    (v_clinica, v_presoter, v_lucia), (v_clinica, v_presoter, v_marta),
    (v_clinica, v_manicura, v_lucia), (v_clinica, v_manicura, v_carmen);

  -- Qué cabina necesita cada tratamiento (presoterapia y manicura no necesitan cabina)
  insert into public.tratamiento_cabinas (clinica_id, tratamiento_id, cabina_id) values
    (v_clinica, v_limpieza, v_cab_facial),
    (v_clinica, v_express, v_cab_facial),
    (v_clinica, v_peeling, v_cab_facial),
    (v_clinica, v_radiofrec, v_cab_facial),
    (v_clinica, v_laser_axi, v_cab_laser),
    (v_clinica, v_laser_pie, v_cab_laser);

  -- Clientas ficticias (teléfonos inventados; la clínica demo nunca envía mensajes)
  insert into public.clientas (id, clinica_id, nombre, telefono, email, notas_asistente,
                               consentimiento_privacidad_at, consentimiento_via, origen) values
    (v_ana,    v_clinica, 'Ana García',      '+34600000101', 'ana@correo.example',
     'Prefiere las tardes. Le gusta que le recuerden la siguiente sesión.', now() - interval '120 days', 'web', 'web'),
    (v_rocio,  v_clinica, 'Rocío Martín',    '+34600000102', null,
     'Siempre con Lucía, a primera hora.', now() - interval '90 days', 'whatsapp', 'whatsapp'),
    (v_pilar,  v_clinica, 'Pilar Fernández', '+34600000103', 'pilar@correo.example',
     null, now() - interval '200 days', 'importacion', 'importacion'),
    (v_elena,  v_clinica, 'Elena Ruiz',      '+34600000104', null,
     'Viene con su hija Sofía.', now() - interval '60 days', 'panel', 'panel'),
    (v_isabel, v_clinica, 'Isabel Moreno',   '+34600000105', 'isabel@correo.example',
     null, now() - interval '30 days', 'web', 'web'),
    (v_lola,   v_clinica, 'Lola Jiménez',    '+34600000106', null,
     'Prefiere sábados por la mañana.', now() - interval '45 days', 'whatsapp', 'whatsapp'),
    (v_nuria,  v_clinica, 'Nuria Díaz',      '+34600000107', null,
     null, null, null, 'importacion');
  -- Sofía reserva desde el teléfono de su madre (Elena): sin teléfono propio
  insert into public.clientas (id, clinica_id, nombre, contacto_principal_id, origen,
                               consentimiento_privacidad_at, consentimiento_via)
  values (v_sofia, v_clinica, 'Sofía Ruiz', v_elena, 'panel', now() - interval '60 days', 'panel');

  insert into public.notas_clinicas (clienta_id, clinica_id, texto) values
    (v_ana, v_clinica, 'Piel sensible. Reacción leve a ácido glicólico en 2025 (dato ficticio de demo).'),
    (v_isabel, v_clinica, 'Toma anticonceptivos orales (dato ficticio de demo).');

  -- Historial pasado (completadas, alguna no presentada y una cancelada).
  -- Lunes de hace 3 semanas, 2 semanas y la semana pasada.
  insert into public.citas (clinica_id, clienta_id, tratamiento_id, profesional_id, cabina_id,
                            inicio, fin, estado, origen) values
    -- Ana: láser axilas, sesiones 1, 2 y 3 con Marta por la tarde
    (v_clinica, v_ana, v_laser_axi, v_marta, v_cab_laser,
     ((v_lunes - 63) + time '17:00') at time zone v_tz, ((v_lunes - 63) + time '17:20') at time zone v_tz, 'completada', 'web'),
    (v_clinica, v_ana, v_laser_axi, v_marta, v_cab_laser,
     ((v_lunes - 28) + time '17:00') at time zone v_tz, ((v_lunes - 28) + time '17:20') at time zone v_tz, 'completada', 'asistente'),
    (v_clinica, v_ana, v_laser_axi, v_marta, v_cab_laser,
     ((v_lunes - 7) + time '17:00') at time zone v_tz, ((v_lunes - 7) + time '17:20') at time zone v_tz, 'completada', 'asistente'),
    -- Rocío: limpiezas con Lucía a primera hora
    (v_clinica, v_rocio, v_limpieza, v_lucia, v_cab_facial,
     ((v_lunes - 34) + time '09:30') at time zone v_tz, ((v_lunes - 34) + time '10:30') at time zone v_tz, 'completada', 'asistente'),
    (v_clinica, v_rocio, v_limpieza, v_lucia, v_cab_facial,
     ((v_lunes - 6) + time '09:30') at time zone v_tz, ((v_lunes - 6) + time '10:30') at time zone v_tz, 'completada', 'asistente'),
    -- Pilar: peeling con Carmen (2 de 4)
    (v_clinica, v_pilar, v_peeling, v_carmen, v_cab_facial,
     ((v_lunes - 20) + time '11:00') at time zone v_tz, ((v_lunes - 20) + time '11:45') at time zone v_tz, 'completada', 'panel'),
    (v_clinica, v_pilar, v_peeling, v_carmen, v_cab_facial,
     ((v_lunes - 5) + time '11:00') at time zone v_tz, ((v_lunes - 5) + time '11:45') at time zone v_tz, 'completada', 'panel'),
    -- Elena y Sofía: manicura juntas
    (v_clinica, v_elena, v_manicura, v_lucia, null,
     ((v_lunes - 11) + time '12:00') at time zone v_tz, ((v_lunes - 11) + time '12:45') at time zone v_tz, 'completada', 'panel'),
    (v_clinica, v_sofia, v_manicura, v_carmen, null,
     ((v_lunes - 11) + time '12:00') at time zone v_tz, ((v_lunes - 11) + time '12:45') at time zone v_tz, 'completada', 'panel'),
    -- Isabel: no se presentó a una radiofrecuencia
    (v_clinica, v_isabel, v_radiofrec, v_marta, v_cab_facial,
     ((v_lunes - 4) + time '18:00') at time zone v_tz, ((v_lunes - 4) + time '18:50') at time zone v_tz, 'no_presentada', 'web'),
    -- Lola: sábado con Lucía; y una cancelada
    (v_clinica, v_lola, v_express, v_lucia, v_cab_facial,
     ((v_lunes - 2) + time '10:00') at time zone v_tz, ((v_lunes - 2) + time '10:30') at time zone v_tz, 'completada', 'asistente'),
    (v_clinica, v_lola, v_presoter, v_marta, null,
     ((v_lunes - 3) + time '19:00') at time zone v_tz, ((v_lunes - 3) + time '19:45') at time zone v_tz, 'cancelada', 'asistente');

  update public.citas set cancelada_por = 'clienta'
  where clienta_id = v_lola and estado = 'cancelada';

  -- Próximas citas: semana que viene (siempre en el futuro)
  insert into public.citas (clinica_id, clienta_id, tratamiento_id, profesional_id, cabina_id,
                            inicio, fin, estado, origen) values
    (v_clinica, v_pilar, v_peeling, v_carmen, v_cab_facial,
     ((v_lunes + 8) + time '11:00') at time zone v_tz, ((v_lunes + 8) + time '11:45') at time zone v_tz, 'confirmada', 'panel'),
    (v_clinica, v_rocio, v_express, v_lucia, v_cab_facial,
     ((v_lunes + 9) + time '09:30') at time zone v_tz, ((v_lunes + 9) + time '10:00') at time zone v_tz, 'pendiente', 'asistente'),
    (v_clinica, v_isabel, v_radiofrec, v_carmen, v_cab_facial,
     ((v_lunes + 9) + time '16:30') at time zone v_tz, ((v_lunes + 9) + time '17:20') at time zone v_tz, 'pendiente', 'web'),
    (v_clinica, v_lola, v_manicura, v_lucia, null,
     ((v_lunes + 12) + time '11:00') at time zone v_tz, ((v_lunes + 12) + time '11:45') at time zone v_tz, 'confirmada', 'asistente'),
    (v_clinica, v_nuria, v_laser_pie, v_marta, v_cab_laser,
     ((v_lunes + 10) + time '17:00') at time zone v_tz, ((v_lunes + 10) + time '18:00') at time zone v_tz, 'pendiente', 'panel');
end;
$$;
