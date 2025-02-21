import { Elysia, t } from 'elysia';
import { and, eq } from 'drizzle-orm';
import db from '../config/db.config';
import { rename } from 'node:fs/promises';
import {
  File,
  FileInSchema,
  FileSelSchema,
  FileTypeIn,
  FileUpSchema,
} from '../schemas/file';
import { messageSchema } from '../utils/utils';
import {
  SharedFile,
  SharedFileInSchema,
  SharedFolder,
} from '../schemas/sharedFiles';
import { itsAdmin, validateSessionToken } from '../utils/auth';
import { Folder } from '../schemas/folder';

const fileRouter = new Elysia({
  prefix: '/files',
  detail: {
    tags: ['Files'],
  },
});

fileRouter.get(
  '/',
  async ({ headers: { auth }, error }) => {
    const isadmin = await itsAdmin(auth);
    if (!isadmin) {
      return error(401, { message: 'No autorizado' });
    }
    return await db.select().from(File);
  },
  {
    headers: t.Object({
      auth: t.String(),
    }),
    response: {
      200: t.Array(FileSelSchema),
      401: messageSchema,
      403: messageSchema,
    },
  }
);

fileRouter.get(
  '/:id',
  async ({ headers: { auth }, params: { id }, error }) => {
    const user = await validateSessionToken(auth);
    if (!user) {
      return error(401, { message: 'No autorizado' });
    }
    const owns = await db
      .select({ id: File.id, userId: File.userId })
      .from(File)
      .where(and(eq(File.userId, user.id), eq(File.id, id)));
    const shared = await db
      .select({ userId: SharedFile.userId, fileId: SharedFile.fileId })
      .from(SharedFile)
      .where(and(eq(SharedFile.userId, user.id), eq(SharedFile.fileId, id)));
    if (owns.length < 1 && shared.length < 1 && user.rol !== 'Admin') {
      return error(403, {
        message: 'No tiene permisos',
      });
    }
    const data = await db.select().from(File).where(eq(File.id, id));
    if (data.length < 1) {
      return error(404, {
        message: 'Not found',
      });
    }
    return data[0];
  },
  {
    headers: t.Object({
      auth: t.String(),
    }),
    params: t.Object({ id: t.Integer() }),
    response: {
      200: FileSelSchema,
      404: messageSchema,
      401: messageSchema,
      403: messageSchema,
    },
  }
);

fileRouter.post(
  '/',
  async ({ headers: { auth }, body, set, error }) => {
    const user = await validateSessionToken(auth);
    if (!user) {
      return error(401, { message: 'No autorizado' });
    }
    const owns = await db
      .select({ id: Folder.id, userId: Folder.userId })
      .from(Folder)
      .where(and(eq(Folder.userId, user.id), eq(Folder.id, body.folderId)));
    const shared = await db
      .select({ id: SharedFolder.userId })
      .from(SharedFolder)
      .where(
        and(
          eq(SharedFolder.userId, user.id),
          eq(SharedFolder.folderId, body.folderId)
        )
      );
    if (owns.length < 1 && shared.length < 1 && user.rol !== 'Admin') {
      return error(403, { message: 'No tiene permisos' });
    }

    set.status = 201;
    const fileName = `${Date.now()}_${body.file.name}`;
    //
    /// O guardar el archivo dentro de la carpeta del dueño
    //
    const route = `assets/UserId${user.id}/${fileName}`;
    await Bun.write(route, body.file);
    const data: FileTypeIn = { ...body, route: route, name: body.file.name };

    const fileId = await db
      .insert(File)
      .values(data)
      .returning({ id: File.id });
    if (shared.length >= 1) {
      const folderOwner = await db
        .select({ userId: Folder.userId })
        .from(Folder)
        .where(eq(Folder.id, body.folderId));
      await db
        .insert(SharedFile)
        .values({ userId: folderOwner[0].userId, fileId: fileId[0].id });
    }
    return {
      message: 'success',
    };
  },
  {
    headers: t.Object({
      auth: t.String(),
    }),
    body: FileInSchema,
    response: {
      201: messageSchema,
      400: messageSchema,
      401: messageSchema,
      403: messageSchema,
    },
  }
);

fileRouter.put(
  '/:id',
  async ({ headers: { auth }, body, params: { id }, error }) => {
    const user = await validateSessionToken(auth);
    if (!user) {
      return error(401, { message: 'No autorizado' });
    }
    const owns = await db
      .select({ id: File.id, userId: File.userId })
      .from(File)
      .where(and(eq(File.userId, user.id), eq(File.id, id)));
    if (owns.length < 1 && user.rol !== 'Admin') {
      return error(403, { message: 'No tiene permisos' });
    }
    const data = await db.select().from(File).where(eq(File.id, id));
    if (data.length < 1) {
      return error(404, { message: 'Not found' });
    }
    const fileName = `${Date.now()}_${body.name}`;
    const oldRoute = data[0].route;
    const oldArr = oldRoute.split('/').slice(0, -1);
    oldArr.push(fileName);
    const newRoute = oldArr.join('/');
    await rename(oldRoute, newRoute);
    await db
      .update(File)
      .set({ name: body.name, route: newRoute, updatedAt: new Date() })
      .where(eq(File.id, id));
    return {
      message: 'success',
    };
  },
  {
    headers: t.Object({
      auth: t.String(),
    }),
    body: FileUpSchema,
    params: t.Object({ id: t.Integer() }),
    response: {
      200: messageSchema,
      401: messageSchema,
      403: messageSchema,
      404: messageSchema,
    },
    detail: {
      description: 'Renombrar archivo',
    },
  }
);

fileRouter.delete(
  '/:id',
  async ({ headers: { auth }, params: { id }, error }) => {
    const user = await validateSessionToken(auth);
    if (!user) {
      return error(401, { message: 'No autorizado' });
    }
    const owns = await db
      .select({ id: Folder.id, userId: Folder.userId })
      .from(Folder)
      .where(and(eq(Folder.userId, user.id), eq(Folder.id, id)));
    if (owns.length < 1 && user.rol !== 'Admin') {
      return error(403, { message: 'No tiene permisos' });
    }
    const data = await db.select().from(File).where(eq(File.id, id));
    if (data.length < 1) {
      return error(404, { message: 'Not found' });
    }
    await db.delete(File).where(eq(File.id, id));
    await Bun.file(data[0].route).delete();
    return { message: 'File deleted' };
  },
  {
    headers: t.Object({
      auth: t.String(),
    }),
    params: t.Object({ id: t.Integer() }),
    response: {
      200: messageSchema,
      401: messageSchema,
      403: messageSchema,
      404: messageSchema,
    },
  }
);

fileRouter.post(
  '/share',
  async ({ body, headers: { auth }, error }) => {
    const user = await validateSessionToken(auth);
    if (!user) {
      return error(401, { message: 'No autorizado' });
    }
    const owns = await db
      .select({ id: File.id, userId: File.userId })
      .from(File)
      .where(and(eq(File.userId, user.id), eq(File.id, body.fileId)));
    if (owns.length < 1 && user.rol !== 'Admin') {
      return error(403, { message: 'No tiene permisos' });
    }
    await db
      .insert(SharedFile)
      .values({ fileId: body.fileId, userId: body.userId, root: true });
    return {
      message: 'success',
    };
  },
  {
    headers: t.Object({
      auth: t.String(),
    }),
    body: SharedFileInSchema,
    response: {
      200: messageSchema,
      401: messageSchema,
      403: messageSchema,
    },
    detail: {
      description: 'Compartir archivo con otro usuario',
    },
  }
);

fileRouter.post(
  '/unshare',
  async ({ body, headers: { auth }, error }) => {
    const user = await validateSessionToken(auth);
    if (!user) {
      return error(401, { message: 'No autorizado' });
    }
    const owns = await db
      .select({ id: File.id, userId: File.userId })
      .from(File)
      .where(and(eq(File.userId, user.id), eq(File.id, body.fileId)));
    if (owns.length < 1 && user.rol !== 'Admin') {
      return error(403, { message: 'No tiene permisos' });
    }
    await db
      .delete(SharedFile)
      .where(
        and(
          eq(SharedFile.fileId, body.fileId),
          eq(SharedFile.userId, body.userId)
        )
      );
    return {
      message: 'success',
    };
  },
  {
    headers: t.Object({
      auth: t.String(),
    }),
    body: SharedFileInSchema,
    response: {
      200: messageSchema,
      401: messageSchema,
      403: messageSchema,
    },
    detail: {
      description: 'Descompartir archivo con otro usuario',
    },
  }
);

export default fileRouter;
