import { Elysia, t } from 'elysia';
import { and, eq } from 'drizzle-orm';
import db from '../config/db.config';
import {
  Employee,
  EmployeeForm,
  EmployeeInSchema,
  EmployeeInWithFormIdSchema,
  EmployeeSelSchema,
  EmployeeUpSchema,
} from '../schemas/employee';
import { messageSchema } from '../utils/utils';
import { itsAdmin, validateSessionToken } from '../utils/auth';
import { Form, FormSchemaSelAssigned } from '../schemas/form';
import { Question, QuestionWithAnswer } from '../schemas/question';
import { Answer } from '../schemas/answer';

const employeeRouter = new Elysia({
  prefix: '/employees',
  detail: {
    tags: ['Employees'],
  },
});

employeeRouter.get(
  '/',
  async ({ headers: { auth }, error }) => {
    const isadmin = await itsAdmin(auth);
    if (!isadmin) {
      return error(401, { message: 'No autorizado' });
    }
    return await db.select().from(Employee);
  },
  {
    headers: t.Object({
      auth: t.String(),
    }),
    response: {
      200: t.Array(EmployeeSelSchema),
      401: messageSchema,
      403: messageSchema,
    },
  }
);

employeeRouter.get(
  '/assigned-forms/:id',
  async ({ headers: { auth }, params: { id }, error }) => {
    const user = await validateSessionToken(auth);
    if (!user) {
      return error(401, { message: 'No autorizado' });
    }
    return await db
      .select({
        id: Form.id,
        logoGba: Form.logoGba,
        logoCliente: Form.logoCliente,
        nombre: Form.nombre,
        titulo: Form.titulo,
        descripcion: Form.descripcion,
        linkFormulario: Form.linkFormulario,
        createdAt: Form.createdAt,
        updatedAt: Form.updatedAt,
      })
      .from(EmployeeForm)
      .leftJoin(Form, eq(EmployeeForm.formId, Form.id))
      .where(eq(EmployeeForm.employeeId, id));
  },
  {
    headers: t.Object({
      auth: t.String(),
    }),
    params: t.Object({ id: t.Integer() }),
    response: {
      200: t.Array(FormSchemaSelAssigned),
      401: messageSchema,
      403: messageSchema,
    },
    detail: {
      description: 'Obtener los formularios que un empleado tiene asignados',
    },
  }
);

employeeRouter.get(
  '/form-answers',
  async ({ headers: { auth }, query: { employeeId, formId }, error }) => {
    // Validar user
    const user = await validateSessionToken(auth);
    if (!user) {
      return error(401, { message: 'No autorizado' });
    }
    return await db
      .select({
        id: Question.id,
        formularioId: Question.formularioId,
        pregunta: Question.pregunta,
        dimension: Question.dimension,
        respuesta: {
          id: Answer.id,
          empleadoId: Answer.empleadoId,
          formularioId: Answer.formularioId,
          preguntaId: Answer.preguntaId,
          respuesta: Answer.respuesta,
          createdAt: Answer.createdAt,
          updatedAt: Answer.updatedAt,
        },
      })
      .from(Question)
      .leftJoin(
        Answer,
        and(
          eq(Answer.formularioId, formId),
          eq(Answer.empleadoId, employeeId),
          eq(Answer.preguntaId, Question.id)
        )
      )
      .where(eq(Question.formularioId, formId));
  },
  {
    headers: t.Object({
      auth: t.String(),
    }),
    query: t.Object({ employeeId: t.Number(), formId: t.Number() }),
    response: {
      200: t.Array(QuestionWithAnswer),
      401: messageSchema,
      403: messageSchema,
    },
    detail: {
      description:
        'Obtener las preguntas y respuestas de un empleado en un formulario especifico',
    },
  }
);

employeeRouter.get(
  '/by-email/:email',
  async ({ params: { email }, error }) => {
    const data = await db
      .select()
      .from(Employee)
      .where(eq(Employee.correo, email));
    if (data.length < 1) {
      return error(404, {
        message: 'Not found',
      });
    }
    return data[0];
  },
  {
    params: t.Object({ email: t.String() }),
    response: {
      200: EmployeeSelSchema,
      404: messageSchema,
      401: messageSchema,
      403: messageSchema,
    },
  }
);

employeeRouter.get(
  '/:id',
  async ({ headers: { auth }, params: { id }, error }) => {
    const isadmin = await itsAdmin(auth);
    if (!isadmin) {
      return error(401, { message: 'No autorizado' });
    }
    const data = await db.select().from(Employee).where(eq(Employee.id, id));
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
      200: EmployeeSelSchema,
      404: messageSchema,
      401: messageSchema,
      403: messageSchema,
    },
  }
);

employeeRouter.post(
  '/',
  async ({ headers: { auth }, body, set, error }) => {
    const isadmin = await itsAdmin(auth);
    if (!isadmin) {
      return error(401, { message: 'No autorizado' });
    }
    set.status = 201;
    await db.transaction(async (tx) => {
      const [empleado] = await tx
        .insert(Employee)
        .values(body)
        .returning({ id: Employee.id });
      if (body.formId) {
        await tx
          .insert(EmployeeForm)
          .values({ employeeId: empleado.id, formId: body.formId });
      }
    });
    await db.insert(Employee).values(body);
    return {
      message: 'success',
    };
  },
  {
    headers: t.Object({
      auth: t.String(),
    }),
    body: EmployeeInWithFormIdSchema,
    response: {
      201: messageSchema,
      401: messageSchema,
    },
  }
);

employeeRouter.put(
  '/:id',
  async ({ headers: { auth }, params: { id }, body, error }) => {
    const isadmin = await itsAdmin(auth);
    if (!isadmin) {
      return error(401, { message: 'No autorizado' });
    }
    await db
      .update(Employee)
      .set({
        updatedAt: new Date(),
        ...body,
      })
      .where(eq(Employee.id, id));
    return {
      message: 'success',
    };
  },
  {
    headers: t.Object({
      auth: t.String(),
    }),
    params: t.Object({ id: t.Integer() }),
    body: EmployeeUpSchema,
    response: {
      200: messageSchema,
      401: messageSchema,
      403: messageSchema,
    },
  }
);

employeeRouter.post(
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
        const [empleado] = await tx
          .insert(Employee)
          .values(el)
          .returning({ id: Employee.id });
        if (el.formId) {
          await tx
            .insert(EmployeeForm)
            .values({ employeeId: empleado.id, formId: el.formId });
        }
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
    body: t.Array(EmployeeInWithFormIdSchema),
    response: {
      201: messageSchema,
      401: messageSchema,
    },
    detail: {
      description: 'Crear varias empleados',
    },
  }
);

employeeRouter.post(
  '/bulk-from-csv',
  async ({ headers: { auth }, body, set, error }) => {
    const isadmin = await itsAdmin(auth);
    if (!isadmin) {
      return error(401, { message: 'No autorizado' });
    }
    set.status = 201;
    const data = await body.csv.text();
    const lines = data.split('\n');
    const all = lines.filter((el) => el).map((line) => line.split(','));

    await db.transaction(async (tx) => {
      for (let i = 0; i < all.length; i++) {
        const el = all[i];
        const [empleado] = await tx
          .insert(Employee)
          .values({
            nombre: el[0],
            noEmpleado: el[1],
            cargo: el[2],
            puesto: el[3],
            correo: el[4],
            telefono: el[5],
            extra1: el[6] || undefined,
          })
          .returning({ id: Employee.id });
        await tx
          .insert(EmployeeForm)
          .values({ employeeId: empleado.id, formId: Number(body.formId) });
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
      formId: t.Union([t.String(), t.Number()]),
      csv: t.File(),
    }),
    response: {
      201: messageSchema,
      401: messageSchema,
    },
    detail: {
      description: 'Crear varias empleados desde un archivo CSV',
    },
  }
);

employeeRouter.delete(
  '/:id',
  async ({ headers: { auth }, params: { id }, error }) => {
    const isadmin = await itsAdmin(auth);
    if (!isadmin) {
      return error(401, { message: 'No autorizado' });
    }

    await db.delete(Employee).where(eq(Employee.id, id));
    return { message: 'Employee deleted' };
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

export default employeeRouter;
