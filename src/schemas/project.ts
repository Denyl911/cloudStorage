import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { pgTable, varchar, text, serial, integer } from 'drizzle-orm/pg-core';
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from 'drizzle-typebox';
import { t } from 'elysia';
import { Client } from './client';
import timestamps from './columns.helpers';
import { User } from './user';

export const Project = pgTable('projects', {
  id: serial().primaryKey(),
  userId: integer()
    .references(() => User.id)
    .notNull(),
  clientId: integer().references(() => Client.id),
  nombre: varchar().notNull(),
  giro: varchar().notNull(),
  descripcion: text(),
  estatus: varchar({ enum: ['Activo', 'En pausa', 'Inactivo'] }).default(
    'Activo'
  ),
  img: varchar().default('public/img/profile.png'),
  ...timestamps,
});

export type ProjectType = InferSelectModel<typeof Project>;
export type ProjectTypeIn = InferInsertModel<typeof Project>;
export const ProjectSelSchema = createSelectSchema(Project);
export const ProjectInSchema = createInsertSchema(Project, {
  img: t.Optional(t.File()),
  userId: t.Union([t.Integer(), t.String()]),
  clientId: t.Union([t.Integer(), t.String()])
});
export const ProjectUpSchema = createUpdateSchema(Project, {
  img: t.Optional(t.File()),
});
