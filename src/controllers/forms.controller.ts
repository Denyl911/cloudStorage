import { Elysia, t } from 'elysia';
import { and, eq } from 'drizzle-orm';
import { randomUUIDv7 } from 'bun';
import path from 'path';
import db from '../config/db.config';
import {
  Form,
  FormInSchema,
  FormInSchemaWithQuestions,
  FormSelSchema,
  FormSelSchemaWithQuestions,
  FormTypeIn,
  FormUpSchema,
} from '../schemas/form';
import { messageSchema } from '../utils/utils';
import { itsAdmin, validateSessionToken } from '../utils/auth';
import { Question, QuestionWithAllAnswers } from '../schemas/question';
import { Employee, EmployeeForm, EmployeesAsignedSchema } from '../schemas/employee';
import { Answer } from '../schemas/answer';

const formRouter = new Elysia({
  prefix: '/forms',
  detail: {
    tags: ['Forms'],
  },
});

formRouter.get(
  '/',
  async ({ headers: { auth }, error }) => {
    const isadmin = await itsAdmin(auth);
    if (!isadmin) {
      return error(401, { message: 'No autorizado' });
    }
    return await db.select().from(Form);
  },
  {
    headers: t.Object({
      auth: t.String(),
    }),
    response: {
      200: t.Array(FormSelSchema),
      401: messageSchema,
      403: messageSchema,
    },
  }
);
formRouter.get(
  '/with-questions/:id',
  async ({ params: { id }, error }) => {
    const [data] = await db.select().from(Form).where(eq(Form.id, id));
    const preguntas = await db
      .select()
      .from(Question)
      .where(eq(Question.formularioId, id));

    if (!data) {
      return error(404, {
        message: 'Not found',
      });
    }
    return {
      ...data,
      preguntas: preguntas,
    };
  },
  {
    params: t.Object({ id: t.Integer() }),
    response: {
      200: FormSelSchemaWithQuestions,
      404: messageSchema,
      401: messageSchema,
    },
    detail: {
      description: 'Obtener un formulario con sus preguntas',
    },
  }
);

formRouter.get(
  '/reply/:hash',
  async ({ params: { hash }, error }) => {
    const [data] = await db
      .select()
      .from(Form)
      .where(
        eq(Form.linkFormulario, `https://api.gbalatam.com/forms/reply/${hash}`)
      );
    const preguntas = await db
      .select()
      .from(Question)
      .where(eq(Question.formularioId, data.id));

    if (!data) {
      return error(404, {
        message: 'Not found',
      });
    }
    return {
      ...data,
      preguntas: preguntas,
    };
  },
  {
    params: t.Object({ hash: t.String() }),
    response: {
      200: FormSelSchemaWithQuestions,
      404: messageSchema,
      401: messageSchema,
    },
    detail: {
      description:
        'Obtener formulario con preguntas mediante el "linkFormulario"',
    },
  }
);

formRouter.get(
  '/:id',
  async ({ headers: { auth }, params: { id }, error }) => {
    const isadmin = await itsAdmin(auth);
    if (!isadmin) {
      return error(401, { message: 'No autorizado' });
    }
    const data = await db.select().from(Form).where(eq(Form.id, id));
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
      200: FormSelSchema,
      404: messageSchema,
      401: messageSchema,
      403: messageSchema,
    },
  }
);

formRouter.post(
  '/',
  async ({ headers: { auth }, body, set, error }) => {
    const isadmin = await itsAdmin(auth);
    if (!isadmin) {
      return error(401, { message: 'No autorizado' });
    }
    set.status = 201;
    let data: FormTypeIn;

    if (body.logoGba && body.logoCliente) {
      const image1: File = body.logoGba;
      const route1 = `public/img/${Date.now()}${path.extname(image1.name)}`;
      await Bun.write(route1, body.logoGba);
      const image2: File = body.logoCliente;
      const route2 = `public/img/${Date.now()}${path.extname(image2.name)}`;
      await Bun.write(route2, body.logoCliente);
      const uid = randomUUIDv7();
      const linkFormulario = `https://api.gbalatam.com/forms/reply/${uid}`;
      data = { ...body, logoGba: route1, logoCliente: route2, linkFormulario };
      await db.insert(Form).values(data);
      return {
        message: 'success',
      };
    } else {
      error(400, { message: 'Logos obligatorios' });
    }
  },
  {
    headers: t.Object({
      auth: t.String(),
    }),
    body: FormInSchema,
    response: {
      201: messageSchema,
      400: messageSchema,
      401: messageSchema,
    },
  }
);

formRouter.post(
  '/with-questions',
  async ({ headers: { auth }, body, set, error }) => {
    const isadmin = await itsAdmin(auth);
    if (!isadmin) {
      return error(401, { message: 'No autorizado' });
    }
    set.status = 201;
    let data: FormTypeIn;

    if (!body.logoGba && !body.logoCliente) {
      return error(400, { message: 'Logos obligatorios' });
    }
    const image1: File = body.logoGba;
    const route1 = `public/img/${Date.now()}${path.extname(image1.name)}`;
    await Bun.write(route1, body.logoGba);
    const image2: File = body.logoCliente;
    const route2 = `public/img/${Date.now()}${path.extname(image2.name)}`;
    await Bun.write(route2, body.logoCliente);
    const uid = randomUUIDv7();
    const linkFormulario = `https://api.gbalatam.com/forms/reply/${uid}`;
    data = { ...body, logoGba: route1, logoCliente: route2, linkFormulario };
    await db.transaction(async (tx) => {
      const [form] = await tx
        .insert(Form)
        .values(data)
        .returning({ id: Form.id });
      const preguntas = JSON.parse(body.preguntas);
      for (let i = 0; i < preguntas.length; i++) {
        const el = preguntas[i];
        await tx.insert(Question).values({ ...el, formularioId: form.id });
      }
    });
    return {
      message: 'success',
    };
  },
  {
    headers: t.Object({
      auth: t.String(),
    }),
    body: FormInSchemaWithQuestions,
    response: {
      201: messageSchema,
      400: messageSchema,
      401: messageSchema,
    },
    detail: {
      description: 'Crear formulario con preguntas',
    },
  }
);

formRouter.get(
  '/all-answers/:id',
  async ({ headers: { auth }, params: { formId }, error }) => {
    // Validar user
    const user = await validateSessionToken(auth);
    if (!user) {
      return error(401, { message: 'No autorizado' });
    }
    // Obtener todas las preguntas del formulario
    const questions = await db
      .select({
        id: Question.id,
        formularioId: Question.formularioId,
        pregunta: Question.pregunta,
        dimension: Question.dimension,
      })
      .from(Question)
      .where(eq(Question.formularioId, formId));

    // Para cada pregunta, obtener todas las respuestas de todos los empleados
    const questionsWithAnswers = await Promise.all(
      questions.map(async (question) => {
        const answers = await db
          .select({
            id: Answer.id,
            empleadoId: Answer.empleadoId,
            formularioId: Answer.formularioId,
            preguntaId: Answer.preguntaId,
            respuesta: Answer.respuesta,
            createdAt: Answer.createdAt,
            updatedAt: Answer.updatedAt,
          })
          .from(Answer)
          .where(
            and(
              eq(Answer.formularioId, formId),
              eq(Answer.preguntaId, question.id)
            )
          );

        return {
          ...question,
          respuestas: answers,
        };
      })
    );

    return questionsWithAnswers;
  },
  {
    headers: t.Object({
      auth: t.String(),
    }),
    params: t.Object({ formId: t.Integer() }),
    response: {
      200: t.Array(QuestionWithAllAnswers),
      401: messageSchema,
      403: messageSchema,
    },
    detail: {
      description:
        'Obtener las preguntas de un formulario con todas las respuestas por pregunta',
    },
  }
);

formRouter.put(
  '/:id',
  async ({ headers: { auth }, params: { id }, body, error }) => {
    const isadmin = await itsAdmin(auth);
    if (!isadmin) {
      return error(401, { message: 'No autorizado' });
    }

    let logoCliente: string | undefined;
    let logoGba: string | undefined;
    if (body.logoCliente) {
      const image: File = body.logoCliente;
      logoCliente = `public/img/${Date.now()}${path.extname(image.name)}`;
      await Bun.write(logoCliente, body.logoCliente);
    }
    if (body.logoGba) {
      const image: File = body.logoGba;
      logoGba = `public/img/${Date.now()}${path.extname(image.name)}`;
      await Bun.write(logoGba, body.logoGba);
    }
    await db
      .update(Form)
      .set({
        updatedAt: new Date(),
        ...body,
        logoGba: logoGba,
        logoCliente: logoCliente,
      })
      .where(eq(Form.id, id));
    return {
      message: 'success',
    };
  },
  {
    headers: t.Object({
      auth: t.String(),
    }),
    params: t.Object({ id: t.Integer() }),
    body: FormUpSchema,
    response: {
      200: messageSchema,
      401: messageSchema,
      403: messageSchema,
    },
  }
);

formRouter.delete(
  '/:id',
  async ({ headers: { auth }, params: { id }, error }) => {
    const isadmin = await itsAdmin(auth);
    if (!isadmin) {
      return error(401, { message: 'No autorizado' });
    }

    await db.delete(Form).where(eq(Form.id, id));
    return { message: 'Form deleted' };
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

formRouter.post(
  '/assign',
  async ({ headers: { auth }, body, error }) => {
    const isadmin = await itsAdmin(auth);
    if (!isadmin) {
      return error(401, { message: 'No autorizado' });
    }
    await db.transaction(async (tx) => {
      for (let i = 0; i < body.employeesIds.length; i++) {
        const id = body.employeesIds[i];
        await tx
          .insert(EmployeeForm)
          .values({ employeeId: id, formId: body.formularioId });
      }
    });
    return {
      message: 'success',
    };
  },
  {
    headers: t.Object({
      auth: t.String(),
    }),
    body: t.Object({
      formularioId: t.Number(),
      employeesIds: t.Array(t.Number()),
    }),
    response: {
      201: messageSchema,
      400: messageSchema,
      401: messageSchema,
    },
    detail: {
      description: 'Asignar Formulario a Empleados medieantes sus Ids',
    },
  }
);

formRouter.post(
  '/unassign',
  async ({ headers: { auth }, body, error }) => {
    const isadmin = await itsAdmin(auth);
    if (!isadmin) {
      return error(401, { message: 'No autorizado' });
    }
    await db.transaction(async (tx) => {
      for (let i = 0; i < body.employeesIds.length; i++) {
        const id = body.employeesIds[i];
        await tx
          .delete(EmployeeForm)
          .where(
            and(
              eq(EmployeeForm.formId, body.formularioId),
              eq(EmployeeForm.employeeId, id)
            )
          );
      }
    });
    return {
      message: 'success',
    };
  },
  {
    headers: t.Object({
      auth: t.String(),
    }),
    body: t.Object({
      formularioId: t.Number(),
      employeesIds: t.Array(t.Number()),
    }),
    response: {
      201: messageSchema,
      400: messageSchema,
      401: messageSchema,
    },
    detail: {
      description: 'Desasignar Formulario a Empleados medieantes sus Ids',
    },
  }
);

formRouter.get(
  '/assigned-users/:id',
  async ({ headers: { auth }, params: { id }, error }) => {
    const user = await validateSessionToken(auth);
    if (!user) {
      return error(401, { message: 'No autorizado' });
    }
    return await db
      .select({
        id: Employee.id,
        nombre: Employee.nombre,
        noEmpleado: Employee.noEmpleado,
        cargo: Employee.cargo,
        puesto: Employee.puesto,
        correo: Employee.correo,
        telefono: Employee.telefono,
        extra1: Employee.extra1,
        createdAt: Employee.createdAt,
        updatedAt: Employee.updatedAt,
      })
      .from(EmployeeForm)
      .leftJoin(Employee, eq(EmployeeForm.employeeId, Employee.id))
      .where(eq(EmployeeForm.formId, id));
  },
  {
    headers: t.Object({
      auth: t.String(),
    }),
    params: t.Object({ id: t.Integer() }),
    response: {
      200: t.Array(EmployeesAsignedSchema),
      401: messageSchema,
      403: messageSchema,
    },
    detail: {
      description: 'Obtener los empleados asignados a un formulario',
    },
  }
);

export default formRouter;
