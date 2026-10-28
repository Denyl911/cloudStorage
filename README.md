# cloudStorage API

![Bun](https://img.shields.io/badge/Runtime-Bun-f9f1e1?logo=bun&logoColor=black)
![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178c6?logo=typescript&logoColor=white)
![Elysia](https://img.shields.io/badge/Framework-Elysia-1a1a2e?logo=hono&logoColor=white)
![Drizzle](https://img.shields.io/badge/ORM-Drizzle-c5f74f?logoColor=black)
![PostgreSQL](https://img.shields.io/badge/DB-PostgreSQL-4169e1?logo=postgresql&logoColor=white)
![Swagger](https://img.shields.io/badge/Docs-Swagger_Oas_3-85ea2d?logo=swagger&logoColor=black)

API REST de almacenamiento en la nube corporativo: gestiona carpetas jerárquicas compartidas entre usuarios y contactos de clientes, proyectos con su estructura de archivos, formularios de diagnóstico asignados a empleados y respuestas exportables a Excel.

Construida con **Bun**, **Elysia**, **Drizzle ORM** y **PostgreSQL**, con documentación interactiva automática (Swagger UI) y validación de entrada/salida en cada endpoint.

## ✨ Características

- **Carpetas jerárquicas compartidas** — árboles de carpetas con herencia automática de permisos: al crear/deshacer contenido o compartir una carpeta padre, los archivos y subcarpetas heredan el acceso recursivamente.
- **Subida y descarga de archivos** — subida con `multipart/form-data`, acceso por header de sesión o token, y **descarga de una carpeta completa como `.zip`** (JSZip, con limpieza automática del temporal).
- **Gestión comercial** — clientes con datos fiscales mexicanos (RFC, uso CFDI, régimen fiscal), proyectos por cliente y contactos vinculados con permisos por todo.
- **Formularios de diagnóstico** — creación con logos, link público autogenerado para responder, asignación a empleados (individual, por lote o **carga masiva desde CSV**), respuestas por empleado y **exportación a Excel** (ExcelJS).
- **Seguridad de sesiones** — tokens UUIDv7 almacenados hasheados con SHA-256, expiración de 30 días con **renovación automática** al usarse, contraseñas con `Bun.password` (bcrypt/argon2).
- **Validación end-to-end** — esquemas TypeBox generados desde el esquema de base de datos (Drizzle + `drizzle-typebox`) en cada endpoint, con documentación de request/response.
- **Docs interactivas** — Swagger UI en [`/docs`](http://localhost:3000/docs) generado automáticamente.

## 🏗️ Arquitectura

API monolítica en capas: routers Elysia (controladores) → Drizzle ORM → PostgreSQL, con archivos servidos desde disco y plugins de CORS, logging y Swagger.

```mermaid
flowchart LR
    A[Cliente\n Admin / Contacto] -->|header auth| B["Elysia HTTP server\n + CORS + Logestic"]
    B --> G{"Guards:\n macros user / admin\n (sesión + rol)"}
    G -->|401 / 403| B
    G --> C[Routers:\n 11 módulos /users /folders /files /projects ...]
    C --> D[Drizzle ORM\n esquemas TypeBox]
    D --> E[(PostgreSQL)]
    C --> F["Disco\n public/img · assets/UserId{n}"]
```

### Autenticación

Declarativa y centralizada: un plugin de **macros** de Elysia expone guardas reutilizables que protegen cada ruta con una opción (`src/utils/auth.macro.ts`):

| Macro | Validación | Respuesta al fallar |
|---|---|---|
| `user: true` | Header `auth` con sesión válida (también habilita el header en Swagger) | `401 No autorizado` |
| `admin: true` | Sesión válida + rol `Admin` | `401 No autorizado` / `403 No tiene permisos` |

Las rutas públicas (login, registro, links de formulario públicos) simplemente no declaran el macro. Un único `onError` central convierte los cortes de los guards en respuestas HTTP con el cuerpo estándar `{ "message": string }`.

## 🗄️ Modelo de datos

```mermaid
erDiagram
    users ||--o{ sessions : "tiene"
    users ||--o{ folders : "posee (etiqueta root)"
    users ||--o{ files : "sube"
    folders |o--o| folders : "parentFolderId (jerarquía)"
    folders |o--o{ projects : "projectId"
    folders ||--o{ files : "contiene"
    users }o--o{ folders : "shared_folders"
    users }o--o{ files : "shared_files"
    users }o--o{ clients : "client_contact"
    users }o--o{ projects : "contact_project"
    clients ||--o{ projects : "tiene"
    employees }o--o{ forms : "employee_form"
    forms ||--o{ questions : "tiene"
    employees ||--o{ answers : "responde"
    questions ||--o{ answers : "recibe"
```

Dos perfiles comparten la tabla `users` mediante el campo `rol`: **Admin** (empleados), **User** (usuario cliente) y **Contacto** (contacto de un cliente, sin acceso a la nube propia pero con acceso a lo compartido).

## 🔗 API

Documentación interactiva con ejemplos y esquemas en [`/docs`](http://localhost:3000/docs). Resumen de los módulos:

| Módulo | Descripción | Highlights |
|---|---|---|
| `POST /users/login` | Inicia sesión (User/Admin), devuelve token + rol | |
| `GET /users/profile` · `GET /users/:id` | Perfil y detalle de usuario | Propiedad + rol Admin |
| `POST /folders` · `GET /folders/:id` · `PUT/DELETE /folders/:id` | CRUD de carpetas | Permisos por propiedad o compartición |
| `POST /folders/share` · `POST /folders/unshare` | Compartir / descompartir carpetas | Herencia recursiva de permisos |
| `GET /folders/download/:id` | Descarga una carpeta como `.zip` | Recursivo, temporal auto-eliminado |
| `POST /files` · `DELETE /files/:id` | Subir / eliminar archivos | Multipart con Bun.file |
| `GET /assets/{ruta}` | Descargar archivo por sesión o `?token=` | |
| `GET /clients` · `POST /clients` | CRUD de clientes (RFC, CFDI, régimen) | |
| `POST /projects/share` | Compartir proyecto con contactos | |
| `POST /employees/bulk-from-csv` | Cargar empleados masivamente desde CSV | Transacción por lote |
| `POST /forms/with-questions` | Crear formulario + preguntas | Genera link público |
| `GET /forms/reply/{hash}` | Obtener formulario público por link | Sin autenticación |
| `GET /forms/excel/:formId` | Exportar respuestas a `.xlsx` | ExcelJS, matriz pregunta×empleado |
| `POST /answers/bulk` | Registrar respuestas (link público) | |

Convenciones: errores estándar `401` (sin/inválida sesión), `403` (permisos insuficientes), `404` (no encontrado) y `422` (validación) con cuerpo `{ "message": string }`.

## 🚀 Getting started

### Prerrequisitos

- [Bun](https://bun.sh) >= 1.1
- PostgreSQL >= 14

### Instalación

```bash
# 1. Clonar e instalar dependencias
git clone <repo-url> && cd cloudStorage
bun install

# 2. Configurar variables de entorno
cp .env.example .env
# → ajusta DATABASE_URL (y PORT si quieres)

# 3. Generar y aplicar migraciones (Drizzle)
bun run db:generate
bun run db:migrate

# 4. Levantar la API
bun run dev
```

La API queda en `http://localhost:3000` y la documentación interactiva en [`http://localhost:3000/docs`](http://localhost:3000/docs).

### Variables de entorno

| Variable | Requerida | Descripción |
|---|---|---|
| `DATABASE_URL` | ✅ | URL de conexión PostgreSQL (`postgres://user:pass@host:port/db`) |
| `PORT` | — | Puerto de la API (por defecto `3000`) |

### Scripts

| Comando | Acción |
|---|---|
| `bun run dev` | Servidor en modo watch |
| `bun run start` | Servidor en producción |
| `bun run db:generate` | Genera SQL de migraciones desde `src/schemas` |
| `bun run db:migrate` | Aplica migraciones a la base |

## 📁 Estructura del proyecto

```text
src/
├── index.ts               # Entrada: plugins, errorHandler central, routers
├── config/
│   ├── db.config.ts       # Cliente Drizzle (DATABASE_URL)
│   └── session.config.ts  # TTL y ventana de renovación de sesiones
├── controllers/           # Routers Elysia: 1 por entidad (11 módulos)
├── schemas/               # Tablas Drizzle + esquemas TypeBox por entidad
└── utils/
    ├── auth.ts            # Ciclo de vida de sesiones (crear/validar/renovar)
    ├── auth.macro.ts      # Macros de guards: user / admin
    └── utils.ts           # Esquemas comunes (messageSchema, authHeaders)
```

## 🔐 Seguridad

- Contraseñas hasheadas con `Bun.password` (bcrypt/argon2, nunca se envían ni guardan en claro).
- Sesiones con token UUIDv7; en base de datos se almacena su **hash SHA-256** y una expiración con **rotación automática** si la sesión está cerca de vencer.
- Autorización en dos niveles: pertenencia de la entidad (usuario dueño / compartido) y rol (`Admin` vs `User`/`Contacto`).
- Validación de entrada y salida en cada endpoint con esquemas TypeBox; Swagger refleja los headers y esquemas del guard.

### Limitaciones conocidas

Por diseño del producto (o pendientes en el roadmap):

- La sesión viaja en un header custom en texto plano sin cookie `HttpOnly` (los tokens públicos de formularios sí viajan por query).
- Los borrados de carpetas/archivos combinan BD y disco sin transaccionalidad compensatoria.
- Sin tests automatizados ni CI/CD todavía.

## 🧭 Roadmap

- [ ] Remover el hash de contraseña de las respuestas de usuario
- [ ] Cookie `HttpOnly` + CSRF como variante de sesión
- [ ] Tests de integración (smoke por módulo) con base de datos de prueba
- [ ] Docker + compose (app + PostgreSQL) para levantar el entorno completo en un comando
- [ ] CI con typecheck y lint automáticos
- [ ] Frontend del portal

---

Hecho con Bun · Elysia · Drizzle ORM · PostgreSQL
