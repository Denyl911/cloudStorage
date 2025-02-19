import { Elysia, t } from 'elysia';
import { and, eq } from 'drizzle-orm';
import path from 'path';
import { mkdir } from 'node:fs/promises';
import db from '../config/db.config';
import {
  Project,
  ProjectInSchema,
  ProjectSelSchema,
  ProjectTypeIn,
  ProjectUpSchema,
} from '../schemas/project';
import { messageSchema } from '../utils/utils';
import { itsAdmin, validateSessionToken } from '../utils/auth';
import {
  ContactProject,
  ContactProjectInSchema,
} from '../schemas/clients_contacts';
import { Folder, FolderSelSchema } from '../schemas/folder';

const projectRouter = new Elysia({
  prefix: '/projects',
  detail: {
    tags: ['Projects'],
  },
});

projectRouter.get(
  '/',
  async ({ headers: { auth }, error }) => {
    const isadmin = await itsAdmin(auth);
    if (!isadmin) {
      return error(401, { message: 'No autorizado' });
    }
    return await db.select().from(Project);
  },
  {
    headers: t.Object({
      auth: t.String(),
    }),
    response: {
      200: t.Array(ProjectSelSchema),
      401: messageSchema,
      403: messageSchema,
    },
  }
);

projectRouter.get(
  '/:id',
  async ({ headers: { auth }, params: { id }, error }) => {
    const user = await validateSessionToken(auth);
    if (!user) {
      return error(401, { message: 'No autorizado' });
    }
    const owns = await db
      .select({ id: Project.id })
      .from(Project)
      .where(and(eq(Project.userId, user.id), eq(Project.id, id)));
    const shared = await db
      .select({
        contactId: ContactProject.contactId,
        projectId: ContactProject.projectId,
      })
      .from(ContactProject)
      .where(
        and(
          eq(ContactProject.contactId, user.id),
          eq(ContactProject.projectId, id)
        )
      );
    if (owns.length < 1 && shared.length < 1 && user.rol !== 'Admin') {
      return error(403, {
        message: 'No tiene permisos',
      });
    }
    const data = await db
      .select({ project: Project, folder: Folder })
      .from(Project)
      .innerJoin(Folder, eq(Folder.projectId, Project.id))
      .where(eq(Project.id, id));
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
      200: t.Object({
        project: ProjectSelSchema,
        folder: FolderSelSchema,
      }),
      404: messageSchema,
      401: messageSchema,
      403: messageSchema,
    },
  }
);

projectRouter.get(
  '/user',
  async ({ headers: { auth }, error }) => {
    const user = await validateSessionToken(auth);
    if (!user) {
      return error(401, { message: 'No autorizado' });
    }
    const data = await db
      .select({ project: Project, folder: Folder })
      .from(Project)
      .innerJoin(Folder, eq(Folder.projectId, Project.id))
      .where(eq(Project.userId, user.id));
    return data[0];
  },
  {
    headers: t.Object({
      auth: t.String(),
    }),
    response: {
      200: t.Union([t.Object({
        project: ProjectSelSchema,
        folder: FolderSelSchema,
      }), t.Undefined()]),
      404: messageSchema,
      401: messageSchema,
      403: messageSchema,
    },
  }
);

projectRouter.post(
  '/',
  async ({ headers: { auth }, body, set, error }) => {
    const user = await validateSessionToken(auth);
    if (!user) {
      return error(401, { message: 'No autorizado' });
    }
    set.status = 201;
    let imageRoute: string | undefined;
    if (body.img) {
      const image: File = body.img;
      imageRoute = `public/img/${Date.now()}${path.extname(image.name)}`;
      await Bun.write(imageRoute, body.img);
    }
    const proyecto = await db
      .insert(Project)
      .values({
        ...body,
        img: imageRoute,
        clientId: Number(body.clientId),
        userId: Number(body.userId),
      })
      .returning({ id: Project.id });
    // await mkdir(`assets/ProjectId${proyecto[0].id}`, { recursive: false });
    await db.insert(Folder).values({
      name: body.nombre,
      userId: Number(body.userId),
      projectId: proyecto[0].id,
    });
    return {
      message: 'success',
    };
  },
  {
    headers: t.Object({
      auth: t.String(),
    }),
    body: ProjectInSchema,
    response: {
      201: messageSchema,
      400: messageSchema,
      401: messageSchema,
      403: messageSchema,
    },
  }
);

projectRouter.put(
  '/:id',
  async ({ headers: { auth }, body, params: { id }, error }) => {
    const user = await validateSessionToken(auth);
    if (!user) {
      return error(401, { message: 'No autorizado' });
    }
    const owns = await db
      .select({ id: Project.id })
      .from(Project)
      .where(and(eq(Project.userId, user.id), eq(Project.id, id)));
    if (owns.length < 1 && user.rol !== 'Admin') {
      return error(403, { message: 'No tiene permisos' });
    }
    let img: string | undefined;
    if (body.img) {
      const image: File = body.img;
      img = `public/img/${Date.now()}${path.extname(image.name)}`;
      await Bun.write(img, body.img);
    }
    const data = await db.select().from(Project).where(eq(Project.id, id));
    if (data.length < 1) {
      return error(404, { message: 'Not found' });
    }
    await db
      .update(Project)
      .set({ updatedAt: new Date(), ...body, img: img })
      .where(eq(Project.id, id));
    return {
      message: 'success',
    };
  },
  {
    headers: t.Object({
      auth: t.String(),
    }),
    body: ProjectUpSchema,
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

projectRouter.delete(
  '/:id',
  async ({ headers: { auth }, params: { id }, error }) => {
    const user = await validateSessionToken(auth);
    if (!user) {
      return error(401, { message: 'No autorizado' });
    }
    const owns = await db
      .select({ id: Project.id, clientId: Project.userId })
      .from(Project)
      .where(and(eq(Project.userId, user.id), eq(Project.id, id)));
    if (owns.length < 1 && user.rol !== 'Admin') {
      return error(403, { message: 'No tiene permisos' });
    }
    const data = await db.select().from(Project).where(eq(Project.id, id));
    if (data.length < 1) {
      return error(404, { message: 'Not found' });
    }
    const imgRoute = data[0].img;
    if (imgRoute && imgRoute !== 'public/img/profile.png') {
      Bun.file(imgRoute).delete();
    }
    await db.delete(Project).where(eq(Project.id, id));
    return { message: 'Project deleted' };
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

projectRouter.post(
  '/share',
  async ({ body, headers: { auth }, error }) => {
    const user = await validateSessionToken(auth);
    if (!user) {
      return error(401, { message: 'No autorizado' });
    }
    const owns = await db
      .select({ id: Project.id })
      .from(Project)
      .where(and(eq(Project.userId, user.id), eq(Project.id, body.projectId)));
    if (owns.length < 1 && user.rol !== 'Admin') {
      return error(403, { message: 'No tiene permisos' });
    }
    await db.insert(ContactProject).values(body);
    return {
      message: 'success',
    };
  },
  {
    headers: t.Object({
      auth: t.String(),
    }),
    body: ContactProjectInSchema,
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

projectRouter.post(
  '/unshare',
  async ({ body, headers: { auth }, error }) => {
    const user = await validateSessionToken(auth);
    if (!user) {
      return error(401, { message: 'No autorizado' });
    }
    const owns = await db
      .select({ id: Project.id })
      .from(Project)
      .where(and(eq(Project.userId, user.id), eq(Project.id, body.projectId)));
    if (owns.length < 1 && user.rol !== 'Admin') {
      return error(403, { message: 'No tiene permisos' });
    }
    await db
      .delete(ContactProject)
      .where(
        and(
          eq(ContactProject.projectId, body.projectId),
          eq(ContactProject.contactId, body.contactId)
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
    body: ContactProjectInSchema,
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

export default projectRouter;
