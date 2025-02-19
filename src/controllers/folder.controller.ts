import { Elysia, t, file } from 'elysia';
import { and, eq, isNull } from 'drizzle-orm';
import JSZip from 'jszip';
import db from '../config/db.config';
import { messageSchema } from '../utils/utils';
import { File, FileSelSchema } from '../schemas/file';
import { itsAdmin, validateSessionToken } from '../utils/auth';
import {
  SharedFile,
  SharedFolder,
  SharedFolderInSchema,
} from '../schemas/sharedFiles';
import {
  Folder,
  FolderInSchema,
  FolderSelSchema,
  FolderUpSchema,
} from '../schemas/folder';

const folderRouter = new Elysia({
  prefix: '/folders',
  detail: {
    tags: ['Folders'],
  },
});

const allContentSchema = t.Object({
  id: t.Integer(),
  folders: t.Array(FolderSelSchema),
  files: t.Array(FileSelSchema),
});

folderRouter.get(
  '/',
  async ({ headers: { auth }, error }) => {
    const isadmin = await itsAdmin(auth);
    if (!isadmin) {
      return error(401, { message: 'No autorizado' });
    }
    return await db.select().from(Folder);
  },
  {
    headers: t.Object({
      auth: t.String(),
    }),
    response: {
      200: t.Array(FolderSelSchema),
      401: messageSchema,
    },
  }
);

folderRouter.get(
  '/:id',
  async ({ headers: { auth }, params: { id }, error }) => {
    const user = await validateSessionToken(auth);
    if (!user) {
      return error(401, { message: 'No autorizado' });
    }
    const owns = await db
      .select({ id: Folder.id })
      .from(Folder)
      .where(and(eq(Folder.userId, user.id), eq(Folder.id, id)));
    const shared = await db
      .select({ userId: SharedFolder.userId, folderId: SharedFolder.folderId })
      .from(SharedFolder)
      .where(
        and(eq(SharedFolder.userId, user.id), eq(SharedFolder.folderId, id))
      );
    if (owns.length < 1 && shared.length < 1 && user.rol !== 'Admin') {
      return error(403, {
        message: 'No tiene permisos',
      });
    }
    const files = await db.select().from(File).where(eq(File.folderId, id));
    const folders = await db
      .select()
      .from(Folder)
      .where(eq(Folder.parentFolderId, id));
    return { id, folders, files };
  },
  {
    headers: t.Object({
      auth: t.String(),
    }),
    params: t.Object({ id: t.Integer() }),
    response: {
      200: allContentSchema,
      401: messageSchema,
      403: messageSchema,
    },
    detail: {
      description: 'Obtener el contenido (Archivos y carpetas) de una carpeta',
    },
  }
);

folderRouter.get(
  '/user-root/:id',
  async ({ headers: { auth }, params: { id }, error }) => {
    const isadmin = await itsAdmin(auth);
    if (!isadmin) {
      return error(401, { message: 'No autorizado' });
    }
    const parent = await db
      .select()
      .from(Folder)
      .where(
        and(
          eq(Folder.name, 'root'),
          eq(Folder.userId, id),
          isNull(Folder.parentFolderId)
        )
      );
    const files = await db
      .select()
      .from(File)
      .where(eq(File.folderId, parent[0].id));
    const folders = await db
      .select()
      .from(Folder)
      .where(eq(Folder.parentFolderId, parent[0].id));
    if (!parent) {
      return error(404, {
        message: 'Not found',
      });
    }
    return { id: parent[0].id, folders, files };
  },
  {
    headers: t.Object({
      auth: t.String(),
    }),
    params: t.Object({ id: t.Integer() }),
    response: {
      200: allContentSchema,
      401: messageSchema,
      403: messageSchema,
      404: messageSchema,
    },
    detail: {
      description:
        'Obtener el contenido (Archivos y carpetas) de la carpeta padre (root) del usuario',
    },
  }
);

folderRouter.get(
  '/root',
  async ({ headers: { auth }, error }) => {
    const user = await validateSessionToken(auth);
    if (!user) {
      return error(401, { message: 'No autorizado' });
    }
    const parent = await db
      .select()
      .from(Folder)
      .where(
        and(
          eq(Folder.name, 'root'),
          eq(Folder.userId, user.id),
          isNull(Folder.parentFolderId)
        )
      );
    const files = await db
      .select()
      .from(File)
      .where(eq(File.folderId, parent[0].id));
    const folders = await db
      .select()
      .from(Folder)
      .where(eq(Folder.parentFolderId, parent[0].id));
    if (!parent) {
      return error(404, {
        message: 'Not found',
      });
    }
    return { id: parent[0].id, folders, files };
  },
  {
    response: {
      200: allContentSchema,
      404: messageSchema,
      401: messageSchema,
    },
    headers: t.Object({
      auth: t.String(),
    }),
    detail: {
      description:
        'Obtener el contenido (Archivos y carpetas) de la carpeta padre (root) del usuario mediante el header de autenticacion',
    },
  }
);

folderRouter.post(
  '/',
  async ({ headers: { auth }, body, set, error }) => {
    if (!body.parentFolderId) {
      return error(400, { message: 'Proporciona un parentFolderId' });
    }
    const user = await validateSessionToken(auth);
    if (!user) {
      return error(401, { message: 'No autorizado' });
    }
    const owns = await db
      .select({ id: Folder.id })
      .from(Folder)
      .where(
        and(eq(Folder.userId, user.id), eq(Folder.id, body.parentFolderId))
      );
    if (owns.length < 1 && user.rol !== 'Admin') {
      return error(403, { message: 'No tiene permisos' });
    }
    set.status = 201;
    await db.insert(Folder).values(body).returning({ id: Folder.id });
    return {
      message: 'success',
    };
  },
  {
    headers: t.Object({
      auth: t.String(),
    }),
    body: FolderInSchema,
    response: {
      201: messageSchema,
      400: messageSchema,
      401: messageSchema,
      403: messageSchema,
    },
  }
);

folderRouter.put(
  '/:id',
  async ({ headers: { auth }, body, params: { id }, error }) => {
    const user = await validateSessionToken(auth);
    if (!user) {
      return error(401, { message: 'No autorizado' });
    }
    const owns = await db
      .select({ id: Folder.id })
      .from(Folder)
      .where(and(eq(Folder.userId, user.id), eq(Folder.id, id)));
    if (owns.length < 1 && user.rol !== 'Admin') {
      return error(403, { message: 'No tiene permisos' });
    }
    await db
      .update(Folder)
      .set({ updatedAt: new Date(), ...body })
      .where(eq(Folder.id, id));
    return {
      message: 'success',
    };
  },
  {
    headers: t.Object({
      auth: t.String(),
    }),
    body: FolderUpSchema,
    params: t.Object({ id: t.Integer() }),
    response: {
      200: messageSchema,
      401: messageSchema,
      403: messageSchema,
    },
  }
);

folderRouter.delete(
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
    await deleteFolderRecursive(id);
    return { message: 'Folder deleted' };
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
    },
  }
);

folderRouter.get(
  '/shared',
  async ({ headers: { auth }, error }) => {
    const user = await validateSessionToken(auth);
    if (!user) {
      return error(401, { message: 'No autorizado' });
    }
    const folders = await db
      .select({ id: Folder.id, name: Folder.name })
      .from(SharedFolder)
      .leftJoin(Folder, eq(SharedFolder.folderId, Folder.id))
      .where(
        and(eq(SharedFolder.userId, user.id), eq(SharedFolder.root, true))
      );
    const files = await db
      .select({ id: File.id, name: File.name, route: File.route })
      .from(SharedFile)
      .leftJoin(File, eq(SharedFile.fileId, File.id))
      .where(and(eq(SharedFile.userId, user.id), eq(SharedFile.root, true)));

    return { folders, files };
  },
  {
    headers: t.Object({
      auth: t.String(),
    }),
    detail: {
      description: 'Obtener carpetas y archivos compartidos',
    },
  }
);

folderRouter.post(
  '/share',
  async ({ body, headers: { auth }, error }) => {
    const user = await validateSessionToken(auth);
    if (!user) {
      return error(401, { message: 'No autorizado' });
    }
    const owns = await db
      .select({ id: Folder.id })
      .from(Folder)
      .where(and(eq(Folder.userId, user.id), eq(Folder.id, body.folderId)));
    if (owns.length < 1 && user.rol !== 'Admin') {
      return error(403, { message: 'No tiene permisos' });
    }
    await assignPermissionRecursive(body.folderId, body.userId);
    await db.insert(SharedFolder).values({ root: true, ...body });
    return {
      message: 'success',
    };
  },
  {
    headers: t.Object({
      auth: t.String(),
    }),
    body: SharedFolderInSchema,
    response: {
      200: messageSchema,
      401: messageSchema,
      403: messageSchema,
    },
    detail: {
      description: 'Compartir carpeta con otro usuario',
    },
  }
);

folderRouter.post(
  '/unshare',
  async ({ body, headers: { auth }, error }) => {
    const user = await validateSessionToken(auth);
    if (!user) {
      return error(401, { message: 'No autorizado' });
    }
    const owns = await db
      .select({ id: Folder.id })
      .from(Folder)
      .where(and(eq(Folder.userId, user.id), eq(Folder.id, body.folderId)));
    if (owns.length < 1 && user.rol !== 'Admin') {
      return error(403, { message: 'No tiene permisos' });
    }
    await desassignPermissionRecursive(body.folderId, body.userId);
    await db
      .delete(SharedFolder)
      .where(
        and(
          eq(SharedFolder.folderId, body.folderId),
          eq(SharedFolder.userId, body.userId)
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
    body: SharedFolderInSchema,
    response: {
      200: messageSchema,
      401: messageSchema,
      403: messageSchema,
    },
    detail: {
      description: 'Desompartir carpeta con otro usuario',
    },
  }
);

folderRouter.get(
  '/download/:id',
  async ({ params: { id }, headers: { auth }, error }) => {
    const user = await validateSessionToken(auth);
    if (!user) {
      return error(401, { message: 'No autorizado' });
    }
    const parent = await db
      .select()
      .from(Folder)
      .where(and(eq(Folder.id, id), eq(Folder.userId, user.id)));
    if (parent.length < 1 && user.rol !== 'Admin') {
      return error(404, {
        message: 'Not found',
      });
    }
    const myzip = new JSZip();
    const zip = await recursiceSearch(
      parent[0].id,
      parent[0].name,
      undefined,
      myzip
    );

    const zipFile = await zip?.generateAsync({ type: 'blob' });
    const zipName = `assets/zips/${parent[0].name}_${Date.now()}.zip`;
    if (zipFile) {
      await Bun.write(zipName, zipFile);
      setTimeout(() => {
        Bun.file(zipName).delete();
      }, 1000 * 60); // 1 Min
    } else {
      return error(500, {
        message: 'Error al comprimir el archivo',
      });
    }
    return file(zipName);
  },
  {
    params: t.Object({ id: t.Integer() }),
    headers: t.Object({
      auth: t.String(),
    }),
    detail: {
      description:
        'Descargar el contenido (Archivos y carpetas) en un .zip de la carpeta indicada',
    },
  }
);

async function recursiceSearch(
  folderId: number,
  folderName: string,
  parentName?: string,
  zipFolder?: typeof JSZip
) {
  const newName = parentName ? `${parentName}/${folderName}` : folderName;
  const files = await db.select().from(File).where(eq(File.folderId, folderId));
  for (let i = 0; i < files.length; i++) {
    const el = files[i];
    const fileContent = await Bun.file(el.route).arrayBuffer();
    const fileName = `${newName}/${el.name}`;
    zipFolder?.file(fileName, fileContent);
  }
  const folders = await db
    .select()
    .from(Folder)
    .where(eq(Folder.parentFolderId, folderId));

  for (let i = 0; i < folders.length; i++) {
    const el = folders[i];
    await recursiceSearch(el.id, el.name, newName, zipFolder);
  }
  return zipFolder;
}

async function assignPermissionRecursive(folderId: number, userId: number) {
  const files = await db.select().from(File).where(eq(File.folderId, folderId));
  for (let i = 0; i < files.length; i++) {
    const el = files[i];
    await db.insert(SharedFile).values({ fileId: el.id, userId: userId });
  }
  const folders = await db
    .select()
    .from(Folder)
    .where(eq(Folder.parentFolderId, folderId));

  for (let i = 0; i < folders.length; i++) {
    const el = folders[i];
    await db.insert(SharedFolder).values({ folderId: el.id, userId: userId });
    await assignPermissionRecursive(el.id, userId);
  }
}

async function desassignPermissionRecursive(folderId: number, userId: number) {
  const files = await db.select().from(File).where(eq(File.folderId, folderId));
  for (let i = 0; i < files.length; i++) {
    const el = files[i];
    await db
      .delete(SharedFile)
      .where(and(eq(SharedFile.fileId, el.id), eq(SharedFile.userId, userId)));
  }
  const folders = await db
    .select()
    .from(Folder)
    .where(eq(Folder.parentFolderId, folderId));

  for (let i = 0; i < folders.length; i++) {
    const el = folders[i];
    await db
      .delete(SharedFolder)
      .where(
        and(eq(SharedFolder.folderId, el.id), eq(SharedFile.userId, userId))
      );
    await desassignPermissionRecursive(el.id, userId);
  }
}

async function deleteFolderRecursive(folderId: number) {
  const files = await db
    .select({ id: File.id, route: File.route })
    .from(File)
    .where(eq(File.folderId, folderId));
  for (let i = 0; i < files.length; i++) {
    const el = files[i];
    await db.delete(SharedFile).where(eq(SharedFile.fileId, el.id));
    await Bun.file(el.route).delete();
  }
  await db.delete(File).where(eq(File.folderId, folderId));

  const folders = await db
    .select()
    .from(Folder)
    .where(eq(Folder.parentFolderId, folderId));
  await db.delete(SharedFolder).where(eq(SharedFolder.folderId, folderId));
  await db.delete(Folder).where(eq(Folder.id, folderId));
  for (let i = 0; i < folders.length; i++) {
    const el = folders[i];
    await deleteFolderRecursive(el.id);
  }
}

export default folderRouter;
