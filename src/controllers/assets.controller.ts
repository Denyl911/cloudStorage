import { Elysia, t, file } from 'elysia';
import { validateSessionToken } from '../utils/auth';
import db from '../config/db.config';
import { File } from '../schemas/file';
import { and, eq } from 'drizzle-orm';
import { SharedFile } from '../schemas/sharedFiles';
import fs from 'fs/promises';

const assetRouter = new Elysia({
  detail: {
    tags: ['Files'],
  },
});

assetRouter.get(
  '/assets/*',
  async ({ params, headers: { auth }, query: { token }, error }) => {
    const ruta = decodeURIComponent(`assets/${params['*']}`);
    const exist = await db
      .select({ id: File.id, route: File.route })
      .from(File)
      .where(eq(File.route, ruta));
    if (exist.length < 1) {
      return error(404, { message: 'Not found' });
    }
    if (!auth) {
      if (token) {
        /// Validar Token
        return file(ruta);
      }
      return error(401, { message: 'No autorizado' });
    }
    const user = await validateSessionToken(auth);
    if (!user) {
      return error(401, { message: 'No autorizado' });
    }
    const owns = await db
      .select({ id: File.id })
      .from(File)
      .where(and(eq(File.userId, user.id), eq(File.id, exist[0].id)));
    const shared = await db
      .select({ userId: SharedFile.userId, fileId: SharedFile.fileId })
      .from(SharedFile)
      .where(
        and(eq(SharedFile.userId, user.id), eq(SharedFile.fileId, exist[0].id))
      );
    if (owns.length < 1 && shared.length < 1 && user.rol !== 'Admin') {
      return error(403, {
        message: 'No tiene permisos',
      });
    }
    return file(`assets/${params['*']}`);
  },
  {
    params: t.Object({ '*': t.String() }),
    headers: t.Object({
      auth: t.Optional(t.String()),
    }),
    query: t.Object({
      token: t.Optional(t.String()),
    }),
    detail: {
      description:
        'Obtener archivo mediante el header de autenticacion o token',
    },
  }
);

assetRouter.get(
  '/base64/*',
  async ({ params, headers: { auth }, query: { token }, error }) => {
    const ruta = decodeURIComponent(params['*']);
    
    const exist = await db
      .select({ id: File.id, route: File.route, name: File.name })
      .from(File)
      .where(eq(File.route, ruta));

    if (exist.length < 1) {
      return error(404, { message: 'Not found' });
    }

    if (!auth) {
      if (token) {
        try {
          const fileBuffer = await fs.readFile(ruta);
          return { name: exist[0].name, base64: fileBuffer.toString('base64') };
        } catch (err) {
          return error(500, { message: 'Error al leer el archivo' });
        }
      }
      return error(401, { message: 'No autorizado' });
    }

    const user = await validateSessionToken(auth);
    if (!user) {
      return error(401, { message: 'No autorizado' });
    }

    const owns = await db
      .select({ id: File.id })
      .from(File)
      .where(and(eq(File.userId, user.id), eq(File.id, exist[0].id)));

    const shared = await db
      .select({ userId: SharedFile.userId, fileId: SharedFile.fileId })
      .from(SharedFile)
      .where(
        and(eq(SharedFile.userId, user.id), eq(SharedFile.fileId, exist[0].id))
      );

    if (owns.length < 1 && shared.length < 1 && user.rol !== 'Admin') {
      return error(403, { message: 'No tiene permisos' });
    }

    try {
      const fileBuffer = await fs.readFile(ruta);
      return { base64: fileBuffer.toString('base64') };
    } catch (err) {
      return error(500, { message: 'Error al leer el archivo' });
    }
  },
  {
    params: t.Object({ '*': t.String() }),
    headers: t.Object({
      auth: t.Optional(t.String()),
    }),
    query: t.Object({
      token: t.Optional(t.String()),
    }),
    detail: {
      description:
        'Obtener archivo en formato base64 mediante autenticación o token',
    },
  }
);

export default assetRouter;
