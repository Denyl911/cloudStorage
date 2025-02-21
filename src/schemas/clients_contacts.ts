import { pgTable, integer, primaryKey } from 'drizzle-orm/pg-core';
import { InferSelectModel } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-typebox';
import { Client } from './client';
import { Project } from './project';
import { User } from './user';

export const ClientContact = pgTable(
  'client_contact',
  {
    clientId: integer()
      .notNull()
      .references(() => Client.id, { onDelete: 'cascade' }),
    contactId: integer()
      .notNull()
      .references(() => User.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.clientId, t.contactId] })]
);

export const ContactProject = pgTable(
  'contact_project',
  {
    projectId: integer()
      .notNull()
      .references(() => Project.id, { onDelete: 'cascade' }),
    contactId: integer()
      .notNull()
      .references(() => User.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.contactId] })]
);

export type ClientContactType = InferSelectModel<typeof ClientContact>;
export const ClientContactInSchema = createInsertSchema(ClientContact);
export const ContactProjectInSchema = createInsertSchema(ContactProject);
