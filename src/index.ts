import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import userRouter from './controllers/user.controller';
import staticPlugin from '@elysiajs/static';
import { Logestic } from 'logestic';
import folderRouter from './controllers/folder.controller';
import fileRouter from './controllers/file.controller';
import assetRouter from './controllers/assets.controller';

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
  .use(folderRouter)
  .use(fileRouter)
  .use(assetRouter)
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
