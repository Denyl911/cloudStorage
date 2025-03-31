import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { integer, pgTable, primaryKey, serial, varchar } from 'drizzle-orm/pg-core';
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from 'drizzle-typebox';
import timestamps from './columns.helpers';
import { Form } from './form';
import { t } from 'elysia';

export const Employee = pgTable('employees', {
  id: serial('id').primaryKey(),
  nombre: varchar('nombre').notNull(),
  noEmpleado: varchar('no_empleado').notNull(),
  cargo: varchar('cargo').notNull(),
  puesto: varchar('puesto').notNull(),
  correo: varchar('correo').notNull(),
  telefono: varchar('telefono').notNull(),
  extra1: varchar('extra1'),
  ...timestamps,
});
export const EmployeeForm = pgTable(
  'employee_form',
  {
    employeeId: integer()
      .notNull()
      .references(() => Employee.id, { onDelete: 'cascade' }),
    formId: integer()
      .notNull()
      .references(() => Form.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.employeeId, t.formId] })]
);
export type EmployeeType = InferSelectModel<typeof Employee>;
export type EmployeeTypeIn = InferInsertModel<typeof Employee>;
export const EmployeeSelSchema = createSelectSchema(Employee);
export const EmployeeInSchema = createInsertSchema(Employee);
export const EmployeeUpSchema = createUpdateSchema(Employee);
export const EmployeesAsignedSchema = t.Object({
  id: t.Nullable(t.Integer()),
  nombre: t.Nullable(t.String()),
  noEmpleado: t.Nullable(t.String()),
  cargo: t.Nullable(t.String()),
  puesto: t.Nullable(t.String()),
  correo: t.Nullable(t.String()),
  telefono: t.Nullable(t.String()),
  extra1: t.Nullable(t.String()),
})