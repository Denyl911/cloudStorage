import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import staticPlugin from '@elysiajs/static';
import { Logestic } from 'logestic';
import userRouter from './controllers/user.controller';
import folderRouter from './controllers/folder.controller';
import fileRouter from './controllers/file.controller';
import assetRouter from './controllers/assets.controller';
import contactRouter from './controllers/contact.controller';
import projectRouter from './controllers/projects.controller';
import clientRouter from './controllers/client.controller';
import answerRouter from './controllers/answer.controller';
import employeeRouter from './controllers/employee.controller';
import formRouter from './controllers/forms.controller';
import questionRouter from './controllers/question.controller';

const app = new Elysia()
  .use(Logestic.preset('fancy'))
  .use(cors())
  .use(
    swagger({
      documentation: {
        info: {
          title: 'GBA Latam API Documentation',
          version: '1.1.0',
          description:
            'Se debe enviar el header "auth" en casi todas las peticiones para comprobar la pertenencia de las carpetas y/o archivos',
        },
      },
      path: '/docs',
    })
  )
  .use(staticPlugin())
  .get('/', () => 'Hello Elysia')
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
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
