import { Elysia, t } from 'elysia';
import { eq, exists, or } from 'drizzle-orm';
import path from 'path';
import db from '../config/db.config';
import {
  Client,
  ClientInSchema,
  ClientSelSchema,
  ClientTypeIn,
  ClientUpSchema,
} from '../schemas/client';
import { messageSchema } from '../utils/utils';
import { itsAdmin, validateSessionToken } from '../utils/auth';
import { ClientContact } from '../schemas/clients_contacts';
import { ClientContactSel, User } from '../schemas/user';
import { Project, ProjectSelSchema } from '../schemas/project';

const clientRouter = new Elysia({
  prefix: '/clients',
  detail: {
    tags: ['Clilentes'],
  },
});

clientRouter.get(
  '/',
  async ({ headers: { auth }, error }) => {
    const isadmin = await itsAdmin(auth);
    if (!isadmin) {
      return error(401, { message: 'No autorizado' });
    }
    return await db.select().from(Client);
  },
  {
    headers: t.Object({
      auth: t.String(),
    }),
    response: {
      200: t.Array(ClientSelSchema),
      401: messageSchema,
    },
  }
);

clientRouter.get(
  '/:id',
  async ({ headers: { auth }, params: { id }, error }) => {
    const user = await validateSessionToken(auth);
    if (!user) {
      return error(401, { message: 'No autorizado' });
    }
    // Revisar tabla clients_contacts
    // if (id !== user.id && user.rol !== 'Admin') {
    //   return error(403, {
    //     message: 'No tiene permisos',
    //   });
    // }
    const data = await db.select().from(Client).where(eq(Client.id, id));
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
      200: ClientSelSchema,
      404: messageSchema,
      401: messageSchema,
      403: messageSchema,
    },
  }
);

clientRouter.get(
  '/contacts/:idClient',
  async ({ headers: { auth }, params: { idClient }, error }) => {
    const user = await validateSessionToken(auth);
    if (!user) {
      return error(401, { message: 'No autorizado' });
    }
    // Revisar tabla clients_contacts
    // if (id !== user.id && user.rol !== 'Admin') {
    //   return error(403, {
    //     message: 'No tiene permisos',
    //   });
    // }
    const data = await db
      .select({
        id: User.id,
        clientId: ClientContact.clientId,
        name: User.name,
        lastName: User.lastName,
        email: User.email,
        image: User.image,
        estatus: User.estatus,
        createdAt: User.createdAt,
        updatedAt: User.updatedAt,
      })
      .from(ClientContact)
      .leftJoin(User, eq(ClientContact.contactId, User.id))
      .where(eq(ClientContact.clientId, idClient));
    return data;
  },
  {
    headers: t.Object({
      auth: t.String(),
    }),
    params: t.Object({ idClient: t.Integer() }),
    response: {
      200: t.Array(ClientContactSel),
      401: messageSchema,
      403: messageSchema,
    },
    detail: {
      description: 'Obtener contactos de un cliente',
    },
  }
);

clientRouter.get(
  '/projects/:idClient',
  async ({ headers: { auth }, params: { idClient }, error }) => {
    const user = await validateSessionToken(auth);
    if (!user) {
      return error(401, { message: 'No autorizado' });
    }
    const data = await db
      .select()
      .from(Project)
      .where(eq(Project.clientId, idClient));

    return data;
  },
  {
    headers: t.Object({
      auth: t.String(),
    }),
    params: t.Object({ idClient: t.Integer() }),
    response: {
      200: t.Array(ProjectSelSchema),
      401: messageSchema,
    },
    detail: {
      description: 'Obtener proyectos de un cliente',
    },
  }
);

clientRouter.post(
  '/',
  async ({ body, set }) => {
    set.status = 201;
    let data: ClientTypeIn;
    if (body.img) {
      const image: File = body.img;
      const route = `public/img/${Date.now()}${path.extname(image.name)}`;
      await Bun.write(route, body.img);
      data = { ...body, img: route };
    } else {
      data = { ...body, img: undefined };
    }
    await db.insert(Client).values(data);
    return {
      message: 'success',
    };
  },
  {
    body: ClientInSchema,
    response: {
      201: messageSchema,
    },
  }
);

clientRouter.put(
  '/:id',
  async ({ headers: { auth }, params: { id }, body, error }) => {
    const user = await validateSessionToken(auth);
    if (!user) {
      return error(401, { message: 'No autorizado' });
    }
    // if (id !== user.id && user.rol !== 'Admin') {
    //   return error(403, {
    //     message: 'No tiene permisos',
    //   });
    // }
    let img: string | undefined;
    if (body.img) {
      const image: File = body.img;
      img = `public/img/${Date.now()}${path.extname(image.name)}`;
      await Bun.write(img, body.img);
    }
    await db
      .update(Client)
      .set({ updatedAt: new Date(), ...body, img: img })
      .where(eq(Client.id, id));
    return {
      message: 'success',
    };
  },
  {
    headers: t.Object({
      auth: t.String(),
    }),
    params: t.Object({ id: t.Integer() }),
    body: ClientUpSchema,
    response: {
      200: messageSchema,
      401: messageSchema,
      403: messageSchema,
    },
  }
);

clientRouter.delete(
  '/:id',
  async ({ headers: { auth }, params: { id }, body, error }) => {
    const user = await validateSessionToken(auth);
    if (!user) {
      return error(401, { message: 'No autorizado' });
    }
    if (id !== user.id && user.rol !== 'Admin') {
      return error(403, {
        message: 'No tiene permisos',
      });
    }
    const data = await db
      .select({ img: Client.img })
      .from(Client)
      .where(eq(Client.id, id));
    const imgRoute = data[0].img;
    if (imgRoute && imgRoute !== 'public/img/default.jpg') {
      await Bun.file(imgRoute).delete();
    }
    await db.delete(ClientContact).where(eq(ClientContact.clientId, id));
    await db.delete(Client).where(eq(Client.id, id));
    return { message: 'Client deleted' };
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

clientRouter.post(
  '/check',
  async ({ body, set }) => {
    const data = await db
      .select()
      .from(Client)
      .where(
        or(
          eq(Client.correo, body.correo),
          eq(Client.whatsapp, body.whatsapp),
          eq(Client.telefono, body.telefono),
          eq(Client.rfc, body.rfc)
        )
      );
    if (data.length < 1) {
      set.status = 204;
      return { exist: 'No' };
    }
    return { exist: 'Si', client: data[0] };
  },
  {
    body: t.Object({
      correo: t.String({ format: 'email' }),
      whatsapp: t.String(),
      telefono: t.String(),
      rfc: t.String(),
    }),
    response: {
      208: t.Object({
        exists: t.String({ default: 'Si' }),
        client: ClientSelSchema,
      }),
      200: t.Object({ exist: t.String({ default: 'No' }) }),
    },
  }
);

export default clientRouter;
