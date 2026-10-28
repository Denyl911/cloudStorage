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
import { authHeaders, messageSchema } from '../utils/utils';
import {
  SharedFile,
  SharedFileInSchema,
  SharedFolder,
} from '../schemas/sharedFiles';
import { authMacros } from '../utils/auth.macro';
import { Folder } from '../schemas/folder';

const fileRouter = new Elysia({
  prefix: '/files',
  detail: {
    tags: ['Files'],
  },
}).use(authMacros);

fileRouter.get(
  '/',
  async () => {
    return await db.select().from(File);
  },
  {
    admin: true,
    headers: authHeaders,
    response: {
      200: t.Array(FileSelSchema),
      401: messageSchema,
      403: messageSchema,
    },
  }
);

fileRouter.get(
  '/:id',
  async ({ user, params: { id }, error }) => {
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
    user: true,
    headers: authHeaders,
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
  async ({ user, body, set, error }) => {
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

    const fileName = `${Date.now()}_${body.file.name}`;
    const route = `assets/UserId${body.userId}/${fileName}`;
    await Bun.write(route, body.file);
    const data: FileTypeIn = { ...body, route: route, name: body.file.name };

    if (owns.length >= 1) {
      set.status = 201;
      const allShared = await db
        .select()
        .from(SharedFolder)
        .where(eq(SharedFolder.folderId, body.folderId));
      const fileId = await db
        .insert(File)
        .values(data)
        .returning({ id: File.id });
      // Compartir el nuevo archivo a los usuarios con los que comparte la carpeta
      for (let i = 0; i < allShared.length; i++) {
        const el = allShared[i];
        await db
          .insert(SharedFile)
          .values({ userId: el.userId, fileId: fileId[0].id });
      }
      return {
        message: 'success',
      };
    }
    const folderOwner = await db
      .select({ userId: Folder.userId })
      .from(Folder)
      .where(eq(Folder.id, body.folderId));
    const fileId = await db
      .insert(File)
      .values({ ...data, userId: folderOwner[0].userId })
      .returning({ id: File.id });
    await db
      .insert(SharedFile)
      .values({ userId: body.userId, fileId: fileId[0].id });
    return {
      message: 'success',
    };
  },
  {
    user: true,
    headers: authHeaders,
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
  async ({ user, body, params: { id }, error }) => {
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
    user: true,
    headers: authHeaders,
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
  async ({ user, params: { id }, error }) => {
    const data = await db
      .select({ id: File.id, route: File.route })
      .from(File)
      .where(eq(File.id, id));
    if (data.length < 1) {
      return error(404, { message: 'Not found' });
    }
    const owns = await db
      .select({ id: File.id, userId: File.userId })
      .from(File)
      .where(and(eq(File.userId, user.id), eq(File.id, id)));
    const shared = await db
      .select({ id: SharedFile.userId })
      .from(SharedFile)
      .where(
        and(eq(SharedFile.userId, user.id), eq(SharedFile.fileId, data[0].id))
      );
    if (owns.length < 1 && shared.length < 1 && user.rol !== 'Admin') {
      return error(403, { message: 'No tiene permisos' });
    }
    await db.delete(File).where(eq(File.id, id));
    await Bun.file(data[0].route).delete();
    return { message: 'File deleted' };
  },
  {
    user: true,
    headers: authHeaders,
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
  async ({ body, user, error }) => {
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
    user: true,
    headers: authHeaders,
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
  async ({ body, user, error }) => {
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
    user: true,
    headers: authHeaders,
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
