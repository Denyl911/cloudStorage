import { Elysia, t } from 'elysia';
import { eq } from 'drizzle-orm';
import db from '../config/db.config';
import {
  Answer,
  AnswerInSchema,
  AnswerSelSchema,
  AnswerUpSchema,
} from '../schemas/answer';
import { messageSchema } from '../utils/utils';
import { itsAdmin, validateSessionToken } from '../utils/auth';

const answerRouter = new Elysia({
  prefix: '/answers',
  detail: {
    tags: ['Answers'],
  },
});

answerRouter.get(
  '/',
  async ({ headers: { auth }, error }) => {
    const isadmin = await itsAdmin(auth);
    if (!isadmin) {
      return error(401, { message: 'No autorizado' });
    }
    return await db.select().from(Answer);
  },
  {
    headers: t.Object({
      auth: t.String(),
    }),
    response: {
      200: t.Array(AnswerSelSchema),
      401: messageSchema,
      403: messageSchema,
    },
  }
);

answerRouter.get(
  '/:id',
  async ({ headers: { auth }, params: { id }, error }) => {
    const isadmin = await itsAdmin(auth);
    if (!isadmin) {
      return error(401, { message: 'No autorizado' });
    }
    const data = await db.select().from(Answer).where(eq(Answer.id, id));
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
      200: AnswerSelSchema,
      404: messageSchema,
      401: messageSchema,
      403: messageSchema,
    },
  }
);

answerRouter.post(
  '/',
  async ({ body, set, error }) => {
    set.status = 201;
    await db.insert(Answer).values(body);
    return {
      message: 'success',
    };
  },
  {
    body: AnswerInSchema,
    response: {
      201: messageSchema,
      401: messageSchema,
    },
  }
);

answerRouter.post(
  '/bulk',
  async ({ body, set, error }) => {
    set.status = 201;
    await db.transaction(async (tx) => {
      for (let i = 0; i < body.length; i++) {
        const el = body[i];
        await tx.insert(Answer).values(el);
      }
    });
    return {
      message: 'success',
    };
  },
  {
    body: t.Array(AnswerInSchema),
    response: {
      201: messageSchema,
      401: messageSchema,
    },
    detail: {
      description:
        'Crear varias respuestas (Se usa para responder todas las preguntas de un formulario)',
    },
  }
);

answerRouter.put(
  '/:id',
  async ({ headers: { auth }, params: { id }, body, error }) => {
    const isadmin = await itsAdmin(auth);
    if (!isadmin) {
      return error(401, { message: 'No autorizado' });
    }
    await db
      .update(Answer)
      .set({
        updatedAt: new Date(),
        ...body,
      })
      .where(eq(Answer.id, id));
    return {
      message: 'success',
    };
  },
  {
    headers: t.Object({
      auth: t.String(),
    }),
    params: t.Object({ id: t.Integer() }),
    body: AnswerUpSchema,
    response: {
      200: messageSchema,
      401: messageSchema,
      403: messageSchema,
    },
  }
);

answerRouter.delete(
  '/:id',
  async ({ headers: { auth }, params: { id }, error }) => {
    const isadmin = await itsAdmin(auth);
    if (!isadmin) {
      return error(401, { message: 'No autorizado' });
    }

    await db.delete(Answer).where(eq(Answer.id, id));
    return { message: 'Answer deleted' };
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

export default answerRouter;
