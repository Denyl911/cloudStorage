import { pgTable, serial, varchar } from 'drizzle-orm/pg-core';
import timestamps from './columns.helpers';
import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import {
  //createInsertSchema,
  createSchemaFactory,
  createSelectSchema,
  createUpdateSchema,
} from 'drizzle-typebox';
import { t } from 'elysia';

export const User = pgTable('users', {
  id: serial().primaryKey(),
  name: varchar().notNull(),
  lastName: varchar().notNull(),
  email: varchar().notNull().unique(),
  password: varchar().notNull(),
  rol: varchar({ enum: ['Admin', 'User', 'Contacto'] }).notNull(),
  image: varchar().default('public/img/default.jpg'),
  estatus: varchar().notNull().default('Activo'),
  ...timestamps,
});

export type UserType = InferSelectModel<typeof User>;
export type UserTypeIn = InferInsertModel<typeof User>;
export const UserSelSchema = createSelectSchema(User);
const { createInsertSchema } = createSchemaFactory({ typeboxInstance: t });
export const UserInSchema = createInsertSchema(User, {
  image: t.Optional(t.File()),
});
export const UserUpSchema = createUpdateSchema(User, {
  image: t.Optional(t.File()),
});
export const ContactoInSchema = t.Composite([
  UserInSchema,
  t.Object({ clientId: t.Integer() }),
]);

export const ClientContactSel = t.Object({
  clientId: t.Integer(),
  name: t.Nullable(t.String()),
  lastName: t.Nullable(t.String()),
  email: t.Nullable(t.String()),
  image: t.Nullable(t.String()),
  estatus: t.Nullable(t.String()),
  createdAt: t.Nullable(t.Date()),
  updatedAt: t.Nullable(t.Date()),
});
