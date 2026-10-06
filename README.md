# Reservas

Agenda online y asistente de WhatsApp con IA para clínicas de estética: reservas, recordatorios y atención a clientas sin comisiones. Una sola instalación sirve a varias clínicas.

## Estado

Proyecto en preparación. El plan por fases y el esquema de la base de datos están en [docs/PLAN.md](docs/PLAN.md).

Este README se completará en la fase (a) con:

- Cómo arrancar el proyecto en tu ordenador
- Cómo desplegarlo en Vercel + Supabase
- Cómo dar de alta una clínica nueva

## Tecnología

- Next.js (App Router) + TypeScript, desplegado en Vercel
- Supabase (Postgres + Auth + seguridad por filas), región UE
- WhatsApp Cloud API de Meta
- API de Anthropic (Claude) para el asistente

## Seguridad

Las claves van siempre en variables de entorno (archivo `.env.local` en tu ordenador y la configuración de Vercel en producción). Ese archivo está excluido del repositorio y nunca se sube.
