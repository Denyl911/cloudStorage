import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import userRouter from './controllers/user.controller';
import staticPlugin from '@elysiajs/static';
import { Logestic } from 'logestic';
import folderRouter from './controllers/folder.controller';
import fileRouter from './controllers/file.controller';
import assetRouter from './controllers/assets.controller';
import contactRouter from './controllers/contact.controller';
import projectRouter from './controllers/projects.controller';
import clientRouter from './controllers/client.controller';

const app = new Elysia()
  .use(Logestic.preset('fancy'))
  .use(cors())
  .use(
    swagger({
      documentation: {
        info: {
          title: 'Cloud Storage Documentation',
          version: '1.0.0',
          description: 'Se debe enviar el header "auth" en casi todas las peticiones para comprobar la pertenencia de las carpetas y/o archivos'
        },
      },
      path: '/docs',
      exclude: ['/']
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
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
