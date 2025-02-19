import { Elysia, t } from 'elysia';
import { eq, ne } from 'drizzle-orm';
import { mkdir } from 'node:fs/promises';
import path from 'path';
import db from '../config/db.config';
import {
  User,
  UserInSchema,
  UserSelSchema,
  UserTypeIn,
  UserUpSchema,
} from '../schemas/user';
import { messageSchema } from '../utils/utils';
import {
  createSession,
  invalidateAllSessions,
  invalidateSession,
  itsAdmin,
  validateSessionToken,
} from '../utils/auth';
import { Folder } from '../schemas/folder';

const userRouter = new Elysia({
  prefix: '/users',
  detail: {
    tags: ['Users'],
  },
});

userRouter.get(
  '/',
  async ({ headers: { auth }, error }) => {
    const isadmin = await itsAdmin(auth);
    if (!isadmin) {
      return error(401, { message: 'No autorizado' });
    }
    return await db.select().from(User).where(ne(User.rol, 'Contacto'));
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

userRouter.get(
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

userRouter.post(
  '/',
  async ({ body, set }) => {
    set.status = 201;
    body.password = await Bun.password.hash(body.password);
    let data: UserTypeIn;
    if (body.image) {
      const image: File = body.image;
      const route = `public/img/${Date.now()}${path.extname(image.name)}`;
      await Bun.write(route, body.image);
      data = { ...body, image: route };
    } else {
      data = { ...body, image: undefined };
    }
    const user = await db.insert(User).values(data).returning({ id: User.id });
    await mkdir(`assets/UserId${user[0].id}`, { recursive: false });
    await db.insert(Folder).values({ name: 'root', userId: user[0].id });
    return {
      message: 'success',
    };
  },
  {
    body: UserInSchema,
    response: {
      201: messageSchema,
    },
  }
);

userRouter.put(
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
    delete body.password;
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

userRouter.delete(
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
      Bun.file(imgRoute).delete();
    }
    await db.delete(User).where(eq(User.id, id));
    //
    /// Eliminar Folders y archivos
    //
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

userRouter.post(
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
    };
  },
  {
    body: t.Object({
      email: t.String({ format: 'email' }),
      password: t.String(),
    }),
    response: {
      200: t.Object({ token: t.String() }),
      400: messageSchema,
      401: messageSchema,
    },
  }
);

userRouter.post(
  '/logout',
  async ({ headers: { auth }, error }) => {
    await invalidateSession(auth);
    return {
      message: 'success',
    };
  },
  {
    headers: t.Object({
      auth: t.String(),
    }),
    response: {
      200: messageSchema,
    },
  }
);

userRouter.post(
  '/unauth/:id',
  async ({ headers: { auth }, params: { id }, error }) => {
    const isadmin = await itsAdmin(auth);
    if (!isadmin) {
      return error(401, { message: 'No autorizado' });
    }
    await invalidateAllSessions(id);
    return {
      message: 'success',
    };
  },
  {
    headers: t.Object({
      auth: t.String(),
    }),
    params: t.Object({ id: t.Integer() }),
    response: {
      200: messageSchema,
      401: messageSchema,
    },
  }
);

export default userRouter;
