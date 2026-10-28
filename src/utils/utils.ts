import { t } from 'elysia';

/** Respuesta de error estándar de la API. */
export const messageSchema = t.Object({
  message: t.String(),
});

/** Header de autenticación requerido (token de sesión en texto plano). */
export const authHeaders = t.Object({
  auth: t.String(),
});
