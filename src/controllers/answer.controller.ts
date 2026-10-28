import { Elysia, t } from 'elysia';
import { eq } from 'drizzle-orm';
import db from '../config/db.config';
import {
  Answer,
  AnswerInSchema,
  AnswerSelSchema,
  AnswerUpSchema,
} from '../schemas/answer';
import { authHeaders, messageSchema } from '../utils/utils';
import { authMacros } from '../utils/auth.macro';

const answerRouter = new Elysia({
  prefix: '/answers',
  detail: {
    tags: ['Answers'],
  },
}).use(authMacros);

answerRouter.get(
  '/',
  async () => {
    return await db.select().from(Answer);
  },
  {
    admin: true,
    headers: authHeaders,
    response: {
      200: t.Array(AnswerSelSchema),
      401: messageSchema,
      403: messageSchema,
    },
  }
);

answerRouter.get(
  '/:id',
  async ({ params: { id }, error }) => {
    const data = await db.select().from(Answer).where(eq(Answer.id, id));
    if (data.length < 1) {
      return error(404, {
        message: 'Not found',
      });
    }
    return data[0];
  },
  {
    admin: true,
    headers: authHeaders,
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
  async ({ body, set }) => {
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
  async ({ body, set }) => {
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
  async ({ body, params: { id } }) => {
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
    admin: true,
    headers: authHeaders,
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
  async ({ params: { id } }) => {
    await db.delete(Answer).where(eq(Answer.id, id));
    return { message: 'Answer deleted' };
  },
  {
    admin: true,
    headers: authHeaders,
    params: t.Object({ id: t.Integer() }),
    response: {
      200: messageSchema,
      401: messageSchema,
      403: messageSchema,
    },
  }
);

export default answerRouter;
