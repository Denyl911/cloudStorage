import { Elysia, t } from 'elysia';
import { and, eq } from 'drizzle-orm';
import { mkdir } from 'node:fs/promises';
import path from 'path';
import db from '../config/db.config';
import {
  ContactoInSchema,
  User,
  UserInSchema,
  UserSelSchema,
  UserTypeIn,
  UserUpSchema,
} from '../schemas/user';
import { messageSchema } from '../utils/utils';
import {
  createSession,
  invalidateSession,
  itsAdmin,
  validateSessionToken,
} from '../utils/auth';
import { ClientContact } from '../schemas/clients_contacts';
import { Folder } from '../schemas/folder';

const contactRouter = new Elysia({
  prefix: '/contacts',
  detail: {
    tags: ['Contactos'],
  },
});

contactRouter.get(
  '/',
  async ({ headers: { auth }, error }) => {
    const isadmin = await itsAdmin(auth);
    if (!isadmin) {
      return error(401, { message: 'No autorizado' });
    }
    return await db.select().from(User).where(eq(User.rol, 'Contacto'));
  },
  {
    headers: t.Object({
      auth: t.String(),
    }),
    response: {
      200: t.Array(UserSelSchema),
      401: messageSchema,
    },
  }
);

contactRouter.get(
  '/profile',
  async ({ headers: { auth }, error }) => {
    const user = await validateSessionToken(auth);
    if (!user) {
      return error(401, { message: 'No autorizado' });
    }
    const data = await db.select().from(User).where(eq(User.id, user.id));
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
    response: {
      200: UserSelSchema,
      404: messageSchema,
      401: messageSchema,
      403: messageSchema,
    },
  }
);

contactRouter.get(
  '/:id',
  async ({ headers: { auth }, params: { id }, error }) => {
    const user = await validateSessionToken(auth);
    if (!user) {
      return error(401, { message: 'No autorizado' });
    }
    if (id !== user.id && user.rol !== 'Admin') {
      return error(403, {
        message: 'No tiene permisos',
      });
    }
    const data = await db.select().from(User).where(eq(User.id, id));
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
      200: UserSelSchema,
      404: messageSchema,
      401: messageSchema,
      403: messageSchema,
    },
  }
);

contactRouter.post(
  '/',
  async ({ body, set }) => {
    set.status = 201;
    body.password = await Bun.password.hash(body.password);
    body.rol = 'Contacto';
    let imgRoute: string | undefined;
    if (body.image) {
      const image: File = body.image;
      imgRoute = `public/img/${Date.now()}${path.extname(image.name)}`;
      await Bun.write(imgRoute, body.image);
    }
    const data = await db
      .insert(User)
      .values({ ...body, image: imgRoute })
      .returning({ id: User.id });
    await db
      .insert(ClientContact)
      .values({ clientId: body.clientId, contactId: data[0].id });
    await mkdir(`assets/UserId${data[0].id}`, { recursive: false });
    await db.insert(Folder).values({ name: 'root', userId: data[0].id });
    return {
      message: 'success',
    };
  },
  {
    body: ContactoInSchema,
    response: {
      201: messageSchema,
    },
  }
);

contactRouter.put(
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
    let img: string | undefined;
    if (body.password) {
      body.password = await Bun.password.hash(body.password);
    }
    if (body.image) {
      const image: File = body.image;
      img = `public/img/${Date.now()}${path.extname(image.name)}`;
      await Bun.write(img, body.image);
    }
    await db
      .update(User)
      .set({ updatedAt: new Date(), ...body, image: img })
      .where(eq(User.id, id));
    return {
      message: 'success',
    };
  },
  {
    headers: t.Object({
      auth: t.String(),
    }),
    params: t.Object({ id: t.Integer() }),
    body: UserUpSchema,
    response: {
      200: messageSchema,
      401: messageSchema,
      403: messageSchema,
    },
  }
);

contactRouter.delete(
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
      .select({ image: User.image })
      .from(User)
      .where(eq(User.id, id));
    const imgRoute = data[0].image;
    if (imgRoute && imgRoute !== 'public/img/default.jpg') {
      await Bun.file(imgRoute).delete();
    }
    //
    /// Eliminar Folders y archivos locales
    //
    await db.delete(ClientContact).where(eq(ClientContact.contactId, id));
    await db.delete(User).where(eq(User.id, id));
    return { message: 'User deleted' };
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

contactRouter.post(
  '/login',
  async ({ body, error }) => {
    const data = await db.select().from(User).where(eq(User.email, body.email));
    if (data.length == 0) {
      return error(400, {
        message: 'Email incorrecto',
      });
    }
    const user = data[0];
    const passMatch = await Bun.password.verify(body.password, user.password);
    if (!passMatch) {
      return error(401, {
        message: 'Password incorrecta',
      });
    }
    const session = await createSession(user.id);
    return {
      token: session.id,
      rol: user.rol,
    };
  },
  {
    body: t.Object({
      email: t.String({ format: 'email' }),
      password: t.String(),
    }),
    response: {
      200: t.Object({
        token: t.String(),
        rol: t.String({ default: 'Contacto' }),
      }),
      400: messageSchema,
      401: messageSchema,
    },
  }
);

contactRouter.post(
  '/logout',
  async ({ cookie: { auth } }) => {
    await invalidateSession(auth.value);
    return {
      message: 'success',
    };
  },
  {
    response: {
      200: messageSchema,
    },
    cookie: t.Cookie({
      auth: t.String(),
    }),
  }
);

contactRouter.post(
  '/clientes/:idContacto',
  async ({ body, params: { idContacto }, headers: { auth } }) => {
    await db
      .insert(ClientContact)
      .values({ clientId: body.clientId, contactId: idContacto });
    return {
      message: 'success',
    };
  },
  {
    params: t.Object({ idContacto: t.Integer() }),
    body: t.Object({ clientId: t.Integer() }),
    response: {
      201: messageSchema,
    },
    detail: {
      description: 'Asignar contacto a cliente',
    },
  }
);

contactRouter.put(
  '/clientes/:idContacto',
  async ({ body, params: { idContacto }, headers: { auth } }) => {
    await db
      .delete(ClientContact)
      .where(
        and(
          eq(ClientContact.clientId, body.clientId),
          eq(ClientContact.contactId, idContacto)
        )
      );
    return {
      message: 'success',
    };
  },
  {
    params: t.Object({ idContacto: t.Integer() }),
    body: t.Object({ clientId: t.Integer() }),
    response: {
      201: messageSchema,
    },
    detail: {
      description: 'Deasignar contacto a cliente',
    },
  }
);

contactRouter.post(
  '/check',
  async ({ body }) => {
    const data = await db.select().from(User).where(eq(User.email, body.email));
    if (data.length < 1) {
      return { exist: 'No' };
    }
    return { exist: 'Si' };
  },
  {
    body: t.Object({ email: t.String({ format: 'email' }) }),
    response: {
      200: t.Object({ exist: t.String({ examples: ['Si', 'No'] }) }),
    },
  }
);

export default contactRouter;
