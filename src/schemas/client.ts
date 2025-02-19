import { pgTable, varchar, text, serial } from 'drizzle-orm/pg-core';
import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from 'drizzle-typebox';
import { t } from 'elysia';
import timestamps from './columns.helpers';

export const Client = pgTable('clients', {
  id: serial().primaryKey(),
  nombre: varchar('nombre', { length: 255 }).notNull(),
  apellidoP: varchar('apellidoP', { length: 255 }),
  apellidoM: varchar('apellidoM', { length: 255 }),
  razon_social: varchar('razon_social', { length: 255 }).notNull(),
  rfc: varchar('rfc', { length: 13 }).notNull(),
  cp: varchar('cp', { length: 5 }).notNull(),
  uso_cfdi: varchar('uso_cfdi', { length: 120 }).notNull(),
  regimen_fiscal: varchar('regimen_fiscal', { length: 255 }).notNull(),
  correo: varchar('correo', { length: 255 }).notNull(),
  direccion: varchar('direccion', { length: 255 }),
  telefono: varchar('telefono', { length: 13 }).notNull(),
  whatsapp: varchar('whatsapp', { length: 255 }),
  nombreComercial: varchar('nombreComercial', { length: 255 }).unique(),
  identificador: varchar('identificador', { length: 255 }).unique(),
  img: text('img').default('public/img/profile.png'),
  estatus: varchar('estatus', { length: 50 }).notNull().default('Activo'),
  ...timestamps,
});

export type ClientType = InferSelectModel<typeof Client>;
export type ClientTypeIn = InferInsertModel<typeof Client>;
export const ClientSelSchema = createSelectSchema(Client);
export const ClientInSchema = createInsertSchema(Client, {
  img: t.Optional(t.File()),
});
export const ClientUpSchema = createUpdateSchema(Client, {
  img: t.Optional(t.File()),
});
