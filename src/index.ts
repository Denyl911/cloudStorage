import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import staticPlugin from '@elysiajs/static';
import { Logestic } from 'logestic';
import userRouter from './controllers/user.controller';
import contactRouter from './controllers/contact.controller';
import folderRouter from './controllers/folder.controller';
import fileRouter from './controllers/file.controller';
import assetRouter from './controllers/asset.controller';
import projectRouter from './controllers/project.controller';
import clientRouter from './controllers/client.controller';
import employeeRouter from './controllers/employee.controller';
import formRouter from './controllers/form.controller';
import questionRouter from './controllers/question.controller';
import answerRouter from './controllers/answer.controller';
import { version } from '../package.json';

const PORT = process.env.PORT ?? 3000;

const app = new Elysia()
  .use(Logestic.preset('fancy'))
  .use(cors())
  .onError(({ error, set }) => {
    // Los macros de autenticación (`src/utils/auth.macro.ts`) abortan con
    // ElysiaCustomStatusResponse al fallar la sesión o el rol: se convierte a
    // la respuesta HTTP correspondiente (401/403) con el mensaje estándar.
    if (error?.constructor?.name === 'ElysiaCustomStatusResponse') {
      const e = error as unknown as { code: number; response: unknown };
      set.status = e.code;
      return e.response as never;
    }
    // Otros errores caen al manejo por defecto de Elysia.
  })
  .use(
    swagger({
      documentation: {
        info: {
          title: 'Cloud Storage API Documentation',
          version: version as string,
          description:
            'Se debe enviar el header "auth" en casi todas las peticiones para comprobar la pertenencia de las carpetas y/o archivos',
        },
      },
      path: '/docs',
    })
  )
  .use(staticPlugin())
  .get('/', () => ({
    name: 'cloudStorage API',
    version: version as string,
    description: 'API de almacenamiento en la nube corporativo',
    docs: '/docs',
  }))
  .use(userRouter)
  .use(contactRouter)
  .use(folderRouter)
  .use(fileRouter)
  .use(projectRouter)
  .use(clientRouter)
  .use(assetRouter)
  .use(employeeRouter)
  .use(formRouter)
  .use(questionRouter)
  .use(answerRouter)
  .listen(PORT);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
