import { Elysia, t } from 'elysia';
import { eq } from 'drizzle-orm';
import db from '../config/db.config';
import {
  Question,
  QuestionInSchema,
  QuestionSelSchema,
  QuestionUpSchema,
  QuestionWithAllAnswers,
} from '../schemas/question';
import { authHeaders, messageSchema } from '../utils/utils';
import { authMacros } from '../utils/auth.macro';
import { Answer } from '../schemas/answer';

const questionRouter = new Elysia({
  prefix: '/questions',
  detail: {
    tags: ['Questions'],
  },
}).use(authMacros);

questionRouter.get(
  '/',
  async () => {
    return await db.select().from(Question);
  },
  {
    admin: true,
    headers: authHeaders,
    response: {
      200: t.Array(QuestionSelSchema),
      401: messageSchema,
      403: messageSchema,
    },
  }
);

questionRouter.get(
  '/:id',
  async ({ params: { id }, error }) => {
    const data = await db.select().from(Question).where(eq(Question.id, id));
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
      200: QuestionSelSchema,
      404: messageSchema,
      401: messageSchema,
      403: messageSchema,
    },
  }
);

questionRouter.get(
  'all-answers/:id',
  async ({ params: { id } }) => {
    const [data] = await db.select().from(Question).where(eq(Question.id, id));
    const answers = await db
      .select()
      .from(Answer)
      .where(eq(Answer.preguntaId, id));

    return {
      ...data,
      respuestas: answers,
    };
  },
  {
    admin: true,
    headers: authHeaders,
    params: t.Object({ id: t.Integer() }),
    response: {
      200: QuestionWithAllAnswers,
      401: messageSchema,
      403: messageSchema,
    },
    detail: {
      description: 'Obtener todas las respuestas de esa pregunta',
    },
  }
);

questionRouter.post(
  '/',
  async ({ body, set }) => {
    set.status = 201;
    await db.insert(Question).values(body);
    return {
      message: 'success',
    };
  },
  {
    admin: true,
    headers: authHeaders,
    body: QuestionInSchema,
    response: {
      201: messageSchema,
      401: messageSchema,
      403: messageSchema,
    },
  }
);

questionRouter.post(
  '/bulk',
  async ({ body, set }) => {
    set.status = 201;
    await db.transaction(async (tx) => {
      for (let i = 0; i < body.length; i++) {
        const el = body[i];
        await tx.insert(Question).values(el);
      }
    });
    return {
      message: 'success',
    };
  },
  {
    admin: true,
    headers: authHeaders,
    body: t.Array(QuestionInSchema),
    response: {
      201: messageSchema,
      401: messageSchema,
      403: messageSchema,
    },
    detail: {
      description: 'Crear varias preguntas',
    },
  }
);

questionRouter.put(
  '/:id',
  async ({ body, params: { id } }) => {
    await db.update(Question).set(body).where(eq(Question.id, id));
    return {
      message: 'success',
    };
  },
  {
    admin: true,
    headers: authHeaders,
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
  async ({ params: { id } }) => {
    await db.delete(Question).where(eq(Question.id, id));
    return { message: 'Question deleted' };
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

export default questionRouter;
