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
import { authHeaders, messageSchema } from '../utils/utils';
import { authMacros } from '../utils/auth.macro';
import { Form, FormSchemaSelAssigned } from '../schemas/form';
import { Question, QuestionWithAnswer } from '../schemas/question';
import { Answer } from '../schemas/answer';

const employeeRouter = new Elysia({
  prefix: '/employees',
  detail: {
    tags: ['Employees'],
  },
}).use(authMacros);

employeeRouter.get(
  '/',
  async () => {
    return await db.select().from(Employee);
  },
  {
    admin: true,
    headers: authHeaders,
    response: {
      200: t.Array(EmployeeSelSchema),
      401: messageSchema,
      403: messageSchema,
    },
  }
);

employeeRouter.get(
  '/assigned-forms/:id',
  async ({ params: { id } }) => {
    return await db
      .select({
        id: Form.id,
        logo: Form.logo,
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
    user: true,
    headers: authHeaders,
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
  async ({ query: { employeeId, formId } }) => {
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
    user: true,
    headers: authHeaders,
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
  async ({ params: { id }, error }) => {
    const data = await db.select().from(Employee).where(eq(Employee.id, id));
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
      200: EmployeeSelSchema,
      404: messageSchema,
      401: messageSchema,
      403: messageSchema,
    },
  }
);

employeeRouter.post(
  '/',
  async ({ body, set }) => {
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
    // await db.insert(Employee).values(body);
    return {
      message: 'success',
    };
  },
  {
    admin: true,
    headers: authHeaders,
    body: EmployeeInWithFormIdSchema,
    response: {
      201: messageSchema,
      401: messageSchema,
      403: messageSchema,
    },
  }
);

employeeRouter.put(
  '/:id',
  async ({ params: { id }, body }) => {
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
    admin: true,
    headers: authHeaders,
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
  async ({ body, set }) => {
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
    admin: true,
    headers: authHeaders,
    body: t.Array(EmployeeInWithFormIdSchema),
    response: {
      201: messageSchema,
      401: messageSchema,
      403: messageSchema,
    },
    detail: {
      description: 'Crear varias empleados',
    },
  }
);

employeeRouter.post(
  '/bulk-from-csv',
  async ({ body, set }) => {
    set.status = 201;
    const data = await body.csv.text();
    const lines = data.split('\n');
    const all = lines.filter((el) => el).map((line) => line.split(','));

    await db.transaction(async (tx) => {
      for (let i = 0; i < all.length; i++) {
        const el = all[i];
        if (isNaN(Number(el[0]))) {
          continue;
        }
        if (el[0] && el[1] && el[2] && el[3] && el[4] && el[5]) {
          const [empleado] = await tx
            .insert(Employee)
            .values({
              nombre: el[1],
              noEmpleado: el[2],
              cargo: el[3],
              puesto: el[4],
              correo: el[5],
              telefono: el[6],
              extra1: el[7] || undefined,
            })
            .returning({ id: Employee.id });
          await tx
            .insert(EmployeeForm)
            .values({ employeeId: empleado.id, formId: Number(el[0]) });
        }
      }
    });
    return {
      message: 'success',
    };
  },
  {
    admin: true,
    headers: authHeaders,
    body: t.Object({
      csv: t.File({
        examples: [
          'IdFormulario,Nombre,NoEmpleado,Cargo,Puesto,Correo,Telefono,Extra',
        ],
      }),
    }),
    response: {
      201: messageSchema,
      401: messageSchema,
      403: messageSchema,
    },
    detail: {
      description: 'Crear varias empleados desde un archivo CSV',
    },
  }
);

employeeRouter.delete(
  '/:id',
  async ({ params: { id } }) => {
    await db.delete(Employee).where(eq(Employee.id, id));
    return { message: 'Employee deleted' };
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

export default employeeRouter;
