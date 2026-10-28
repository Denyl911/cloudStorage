/**
 * Configuración de sesiones de usuario.
 *
 * Una expira al `SESSION_TTL_DAYS` desde su creación (o última renovación) y
 * se renueva automáticamente al usarse si está a menos de
 * `SESSION_RENEW_THRESHOLD_DAYS` de expirar.
 */

/** Milisegundos que tiene un día. */
export const DAY_MS = 24 * 60 * 60 * 1000;

/** Duración de una sesión desde su creación o última renovación (días). */
export const SESSION_TTL_DAYS = 30;

/**
 * Ventana de renovación: si la sesión expira antes de N días,
 * se renueva automáticamente al usarse.
 */
export const SESSION_RENEW_THRESHOLD_DAYS = 15;
