import { Elysia } from 'elysia';
import { validateSessionToken } from './auth';

/**
 * Macros de autenticación para los routers de la API.
 *
 * - `user: true`  → valida el header `auth`, expone `user` en el contexto y
 *   responde 401 ("No autorizado") si no hay una sesión válida.
 * - `admin: true` → igual que `user`, pero exige rol Admin y responde
 *   403 ("No tiene permisos") si el rol no coincide.
 *
 * Uso:
 * ```ts
 * const router = new Elysia({ prefix: '/ejemplo' }).use(authMacros);
 * router.get('/', handler, { user: true, headers: authHeaders, response: {...} });
 * ```
 */
export const authMacros = new Elysia({ name: 'guards.auth' }).macro({
  user: {
    async resolve({ headers, error }) {
      const user = await validateSessionToken(
        (headers as { auth?: string }).auth ?? ''
      );
      if (!user) return error(401, { message: 'No autorizado' });
      return { user };
    },
  },
  admin: {
    async resolve({ headers, error }) {
      const user = await validateSessionToken(
        (headers as { auth?: string }).auth ?? ''
      );
      if (!user) return error(401, { message: 'No autorizado' });
      if (user.rol !== 'Admin')
        return error(403, { message: 'No tiene permisos' });
      return { user };
    },
  },
});
