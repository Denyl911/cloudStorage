import { Elysia, t } from 'elysia';
import { and, eq, inArray } from 'drizzle-orm';
import { randomUUIDv7 } from 'bun';
import path from 'path';
import ExcelJS from 'exceljs';
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
import { authHeaders, messageSchema } from '../utils/utils';
import { authMacros } from '../utils/auth.macro';
import { Question, QuestionWithAllAnswers } from '../schemas/question';
import {
  Employee,
  EmployeeForm,
  EmployeesAsignedSchema,
} from '../schemas/employee';
import { Answer } from '../schemas/answer';

const SITE_URL = process.env.SITE_URL ?? "http://localhost:3000"

const formRouter = new Elysia({
  prefix: '/forms',
  detail: {
    tags: ['Forms'],
  },
}).use(authMacros);

formRouter.get(
  '/',
  async () => {
    return await db.select().from(Form);
  },
  {
    admin: true,
    headers: authHeaders,
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
        eq(Form.linkFormulario, `${SITE_URL}/forms/reply/${hash}`)
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
  async ({ params: { id }, error }) => {
    const data = await db.select().from(Form).where(eq(Form.id, id));
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
      200: FormSelSchema,
      404: messageSchema,
      401: messageSchema,
      403: messageSchema,
    },
  }
);

formRouter.post(
  '/',
  async ({ body, set, error }) => {
    set.status = 201;
    set.status = 201;
    let data: FormTypeIn;

    if (body.logo && body.logoCliente) {
      const image1: File = body.logo;
      const route1 = `public/img/${Date.now()}${path.extname(image1.name)}`;
      await Bun.write(route1, body.logo);
      const image2: File = body.logoCliente;
      const route2 = `public/img/${Date.now()}${path.extname(image2.name)}`;
      await Bun.write(route2, body.logoCliente);
      const uid = randomUUIDv7();
      const linkFormulario = `${SITE_URL}/forms/reply/${uid}`;
      data = { ...body, logo: route1, logoCliente: route2, linkFormulario };
      await db.insert(Form).values(data);
      return {
        message: 'success',
      };
    } else {
      error(400, { message: 'Logos obligatorios' });
    }
  },
  {
    admin: true,
    headers: authHeaders,
    body: FormInSchema,
    response: {
      201: messageSchema,
      400: messageSchema,
      401: messageSchema,
      403: messageSchema,
    },
  }
);

formRouter.post(
  '/with-questions',
  async ({ body, set, error }) => {
    set.status = 201;
    let data: FormTypeIn;

    if (!body.logo && !body.logoCliente) {
      return error(400, { message: 'Logos obligatorios' });
    }
    const image1: File = body.logo;
    const route1 = `public/img/${Date.now()}${path.extname(image1.name)}`;
    await Bun.write(route1, body.logo);
    const image2: File = body.logoCliente;
    const route2 = `public/img/${Date.now()}${path.extname(image2.name)}`;
    await Bun.write(route2, body.logoCliente);
    const uid = randomUUIDv7();
    const linkFormulario = `${SITE_URL}/forms/reply/${uid}`;
    data = { ...body, logo: route1, logoCliente: route2, linkFormulario };
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
    admin: true,
    headers: authHeaders,
    body: FormInSchemaWithQuestions,
    response: {
      201: messageSchema,
      400: messageSchema,
      401: messageSchema,
      403: messageSchema,
    },
    detail: {
      description: 'Crear formulario con preguntas',
    },
  }
);

formRouter.get(
  '/all-answers/:formId',
  async ({ params: { formId } }) => {
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
    user: true,
    headers: authHeaders,
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

formRouter.get(
  '/excel/:formId',
  async ({ set, params: { formId }, error }) => {

    // Obtener todas las preguntas del formulario
    const questions = await db
      .select({
        id: Question.id,
        pregunta: Question.pregunta, // Solo necesitamos el texto de la pregunta
      })
      .from(Question)
      .where(eq(Question.formularioId, formId));

    // Obtener todas las respuestas para este formulario
    const answers = await db
      .select({
        empleadoId: Answer.empleadoId,
        preguntaId: Answer.preguntaId,
        respuesta: Answer.respuesta,
      })
      .from(Answer)
      .where(eq(Answer.formularioId, formId));

    // Obtener la información de todos los empleados que respondieron
    const employeeIds = [...new Set(answers.map((a) => a.empleadoId))];
    const employees = await db
      .select({
        id: Employee.id,
        nombre_empleado: Employee.nombre, // Ajusta los nombres de columna de tu modelo Employee
        cargo: Employee.cargo,
        puesto: Employee.puesto,
        correo: Employee.correo,
      })
      .from(Employee)
      .where(inArray(Employee.id, employeeIds)); // Asumo que inArray está disponible o usas un equivalente

    // --- 2. Reestructurar Datos en Filas ---

    type QuestionAnswers = {
      [preguntaId: number]: number;
    };
    type EmployeeAnswersMap = {
      [empleadoId: number]: QuestionAnswers;
    };
    // Mapeo de Respuestas por EmpleadoId
    const employeeAnswersMap = answers.reduce((acc, a) => {
      if (!acc[a.empleadoId]) {
        acc[a.empleadoId] = {};
      }
      acc[a.empleadoId][a.preguntaId] = a.respuesta;
      return acc;
    }, {} as EmployeeAnswersMap);

    // Generar las filas de datos
    const dataRows = employees.map((employee) => {
      const row = [
        employee.id,
        employee.nombre_empleado,
        employee.cargo,
        employee.puesto,
        employee.correo,
      ];

      // Añadir respuestas en el orden de las preguntas
      questions.forEach((question) => {
        const respuesta = employeeAnswersMap[employee.id]?.[question.id];
        row.push(respuesta);
      });

      return row;
    });

    // --- 3. Preparar Columnas y Generar XLSX ---

    // Cabeceras fijas
    const fixedHeaders = [
      'id_empleado',
      'nombre_empleado',
      'cargo',
      'puesto',
      'email',
    ];

    // Cabeceras dinámicas (las preguntas)
    const questionHeaders = questions.map((q) => q.pregunta);

    // Columnas completas para ExcelJS
    const columns = [...fixedHeaders, ...questionHeaders].map((header) => ({
      header: header,
      key: header,
      width: header.length < 20 ? 20 : header.length + 5,
    }));

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Respuestas del Formulario');

    // Añadir columnas y filas
    worksheet.columns = columns;
    worksheet.addRows(dataRows);

    // --- 4. Enviar la Respuesta ---

    // Escribir el libro de trabajo en un buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Establecer las cabeceras de respuesta para la descarga
    set.headers['Content-Type'] =
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    set.headers[
      'Content-Disposition'
    ] = `attachment; filename=respuestas_formulario_${formId}.xlsx`;

    // Devolver el buffer
    return buffer;
  },
  {
    user: true,
    headers: authHeaders,
    params: t.Object({ formId: t.Integer() }),
    response: {
      401: messageSchema,
      403: messageSchema,
    },
    detail: {
      description:
        'Obtener las respuestas de un formulario en formato XLSX. Nota: la respuesta 200 es un archivo binario .xlsx y no se valida contra esquema.',
    },
  }
);

formRouter.put(
  '/:id',
  async ({ body, params: { id } }) => {

    let logoCliente: string | undefined;
    let logo: string | undefined;
    if (body.logoCliente) {
      const image: File = body.logoCliente;
      logoCliente = `public/img/${Date.now()}${path.extname(image.name)}`;
      await Bun.write(logoCliente, body.logoCliente);
    }
    if (body.logo) {
      const image: File = body.logo;
      logo = `public/img/${Date.now()}${path.extname(image.name)}`;
      await Bun.write(logo, body.logo);
    }
    await db
      .update(Form)
      .set({
        updatedAt: new Date(),
        ...body,
        logo: logo,
        logoCliente: logoCliente,
      })
      .where(eq(Form.id, id));
    return {
      message: 'success',
    };
  },
  {
    admin: true,
    headers: authHeaders,
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
  async ({ params: { id } }) => {
    await db.delete(Form).where(eq(Form.id, id));
    return { message: 'Form deleted' };
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

formRouter.post(
  '/assign',
  async ({ body }) => {
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
    admin: true,
    headers: authHeaders,
    body: t.Object({
      formularioId: t.Number(),
      employeesIds: t.Array(t.Number()),
    }),
    response: {
      201: messageSchema,
      400: messageSchema,
      401: messageSchema,
      403: messageSchema,
    },
    detail: {
      description: 'Asignar Formulario a Empleados medieantes sus Ids',
    },
  }
);

formRouter.post(
  '/unassign',
  async ({ body }) => {
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
    admin: true,
    headers: authHeaders,
    body: t.Object({
      formularioId: t.Number(),
      employeesIds: t.Array(t.Number()),
    }),
    response: {
      201: messageSchema,
      400: messageSchema,
      401: messageSchema,
      403: messageSchema,
    },
    detail: {
      description: 'Desasignar Formulario a Empleados medieantes sus Ids',
    },
  }
);

formRouter.get(
  '/assigned-users/:id',
  async ({ params: { id } }) => {
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
    user: true,
    headers: authHeaders,
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
