import { pgTable, serial, varchar, text } from 'drizzle-orm/pg-core';
import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from 'drizzle-typebox';
import { t } from 'elysia';
import timestamps from './columns.helpers';
import { QuestionSelSchema } from './question';

export const Form = pgTable('forms', {
  id: serial('id').primaryKey(),
  logoGba: varchar('logo_gba').notNull(),
  logoCliente: varchar('logo_cliente').notNull(),
  nombre: varchar('nombre').notNull(),
  titulo: varchar('titulo').notNull(),
  descripcion: text('descripcion').notNull(),
  linkFormulario: varchar('link_formulario').notNull(),
  ...timestamps,
});

export type FormType = InferSelectModel<typeof Form>;
export type FormTypeIn = InferInsertModel<typeof Form>;
export const FormSelSchema = createSelectSchema(Form);
export const FormSelSchemaWithQuestions = t.Composite([
  FormSelSchema,
  t.Object({ preguntas: t.Array(QuestionSelSchema) }),
]);
export const FormInSchema = createInsertSchema(Form, {
  logoGba: t.File(),
  logoCliente: t.File(),
});

export const FormInSchemaWithQuestions = t.Composite([
  FormInSchema,
  t.Object({
    preguntas: t.String({
      pattern: '[{ "pregunta": "", "dimension": "" }]',
    }),
  }),
]);
export const FormUpSchema = createUpdateSchema(Form, {
  logoGba: t.Nullable(t.File()),
  logoCliente: t.Nullable(t.File()),
});

export const FormSchemaSelAssigned = t.Object({
  id: t.Nullable(t.Number()),
  logoGba: t.Nullable(t.String()),
  logoCliente: t.Nullable(t.String()),
  nombre: t.Nullable(t.String()),
  titulo: t.Nullable(t.String()),
  descripcion: t.Nullable(t.String()),
  linkFormulario: t.Nullable(t.String()),
});
