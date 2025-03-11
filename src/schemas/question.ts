import { pgTable, serial, varchar, integer, text } from 'drizzle-orm/pg-core';
import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from 'drizzle-typebox';
import { Form } from './form';
import { t } from 'elysia';

export const Question = pgTable('questions', {
  id: serial('id').primaryKey(),
  formularioId: integer('formulario_id')
    .notNull()
    .references(() => Form.id, { onDelete: 'cascade' }),
  pregunta: text('pregunta').notNull(),
  dimension: varchar('dimension', {
    enum: ['Cultura', 'Organización', 'Tecnología', 'Insights'],
  }).notNull(),
});

export type QuestionType = InferSelectModel<typeof Question>;
export type QuestionTypeIn = InferInsertModel<typeof Question>;
export const QuestionSelSchema = createSelectSchema(Question);
export const QuestionInSchema = createInsertSchema(Question);
export const QuestionUpSchema = createUpdateSchema(Question);
export const QuestionWithAnswer = t.Composite([
  QuestionSelSchema,
  t.Object({
    respuesta: t.Nullable(
      t.Object({
        id: t.Number(),
        empleadoId: t.Nullable(t.Number()),
        formularioId: t.Nullable(t.Number()),
        preguntaId: t.Nullable(t.Number()),
        respuesta: t.Nullable(t.Number()), // Usamos smallint para 0, 1, 2, 3
        createdAt: t.Nullable(t.Date()),
        updatedAt: t.Nullable(t.Date()),
      })
    ),
  }),
]);
