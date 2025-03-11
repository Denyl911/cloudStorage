import { Elysia, t } from 'elysia';
import { eq } from 'drizzle-orm';
import db from '../config/db.config';
import {
  Question,
  QuestionInSchema,
  QuestionSelSchema,
  QuestionUpSchema,
} from '../schemas/question';
import { messageSchema } from '../utils/utils';
import { itsAdmin } from '../utils/auth';

const questionRouter = new Elysia({
  prefix: '/questions',
  detail: {
    tags: ['Questions'],
  },
});

questionRouter.get(
  '/',
  async ({ headers: { auth }, error }) => {
    const isadmin = await itsAdmin(auth);
    if (!isadmin) {
      return error(401, { message: 'No autorizado' });
    }
    return await db.select().from(Question);
  },
  {
    headers: t.Object({
      auth: t.String(),
    }),
    response: {
      200: t.Array(QuestionSelSchema),
      401: messageSchema,
      403: messageSchema,
    },
  }
);

questionRouter.get(
  '/:id',
  async ({ headers: { auth }, params: { id }, error }) => {
    const isadmin = await itsAdmin(auth);
    if (!isadmin) {
      return error(401, { message: 'No autorizado' });
    }
    const data = await db.select().from(Question).where(eq(Question.id, id));
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
      200: QuestionSelSchema,
      404: messageSchema,
      401: messageSchema,
      403: messageSchema,
    },
  }
);

questionRouter.post(
  '/',
  async ({ headers: { auth }, body, set, error }) => {
    const isadmin = await itsAdmin(auth);
    if (!isadmin) {
      return error(401, { message: 'No autorizado' });
    }
    set.status = 201;
    await db.insert(Question).values(body);
  },
  {
    headers: t.Object({
      auth: t.String(),
    }),
    body: QuestionInSchema,
    response: {
      201: messageSchema,
      401: messageSchema,
    },
  }
);

questionRouter.post(
  '/bulk',
  async ({ headers: { auth }, body, set, error }) => {
    const isadmin = await itsAdmin(auth);
    if (!isadmin) {
      return error(401, { message: 'No autorizado' });
    }
    set.status = 201;
    await db.transaction(async (tx) => {
      for (let i = 0; i < body.length; i++) {
        const el = body[i];
        await tx.insert(Question).values(el);
      }
    });
  },
  {
    headers: t.Object({
      auth: t.String(),
    }),
    body: t.Array(QuestionInSchema),
    response: {
      201: messageSchema,
      401: messageSchema,
    },
    detail: {
      description: 'Crear varias pregunatas',
    },
  }
);

questionRouter.put(
  '/:id',
  async ({ headers: { auth }, params: { id }, body, error }) => {
    const isadmin = await itsAdmin(auth);
    if (!isadmin) {
      return error(401, { message: 'No autorizado' });
    }
    await db.update(Question).set(body).where(eq(Question.id, id));
    return {
      message: 'success',
    };
  },
  {
    headers: t.Object({
      auth: t.String(),
    }),
    params: t.Object({ id: t.Integer() }),
    body: QuestionUpSchema,
    response: {
      200: messageSchema,
      401: messageSchema,
      403: messageSchema,
    },
  }
);

questionRouter.delete(
  '/:id',
  async ({ headers: { auth }, params: { id }, error }) => {
    const isadmin = await itsAdmin(auth);
    if (!isadmin) {
      return error(401, { message: 'No autorizado' });
    }

    await db.delete(Question).where(eq(Question.id, id));
    return { message: 'Question deleted' };
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

export default questionRouter;
