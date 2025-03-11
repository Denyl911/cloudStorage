import { pgTable, serial, integer, smallint } from 'drizzle-orm/pg-core';
import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from 'drizzle-typebox';
import { Employee } from './employee';
import { Form } from './form';
import { Question } from './question';
import timestamps from './columns.helpers';

export const Answer = pgTable('answers', {
  id: serial('id').primaryKey(),
  empleadoId: integer('empleado_id')
    .notNull()
    .references(() => Employee.id, { onDelete: 'cascade' }),
  formularioId: integer('formulario_id')
    .notNull()
    .references(() => Form.id, { onDelete: 'cascade' }),
  preguntaId: integer('pregunta_id')
    .notNull()
    .references(() => Question.id, { onDelete: 'cascade' }),
  respuesta: smallint('respuesta').notNull(), // Usamos smallint para 0, 1, 2, 3
  ...timestamps,
});

export type AnswerType = InferSelectModel<typeof Answer>;
export type AnswerTypeIn = InferInsertModel<typeof Answer>;
export const AnswerSelSchema = createSelectSchema(Answer);
export const AnswerInSchema = createInsertSchema(Answer);
export const AnswerUpSchema = createUpdateSchema(Answer);
