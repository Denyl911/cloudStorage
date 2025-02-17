import { pgTable, serial, varchar } from 'drizzle-orm/pg-core';
import timestamps from './columns.helpers';
import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-typebox';
import { t } from 'elysia';

export const User = pgTable('users', {
  id: serial().primaryKey(),
  name: varchar().notNull(),
  lastName: varchar().notNull(),
  email: varchar().notNull().unique(),
  password: varchar().notNull(),
  rol: varchar().notNull(),
  image: varchar().default('public/img/default.jpg'),
  estatus: varchar().notNull().default('Activo'),
  ...timestamps,
});

export type UserType = InferSelectModel<typeof User>;
export type UserTypeIn = InferInsertModel<typeof User>;
export const UserSelSchema = createSelectSchema(User);
export const UserInSchema = createInsertSchema(User, {
  image: t.Optional(t.File()),
});
export const UserUpSchema = createUpdateSchema(User);