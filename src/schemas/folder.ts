import {
  AnyPgColumn,
  integer,
  pgTable,
  serial,
  varchar,
} from 'drizzle-orm/pg-core';
import timestamps from './columns.helpers';
import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { User } from './user';
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from 'drizzle-typebox';
import { Project } from './project';

export const Folder = pgTable('folders', {
  id: serial().primaryKey(),
  name: varchar().notNull(),
  userId: integer()
    .notNull()
    .references(() => User.id, { onDelete: 'cascade' }),
  projectId: integer().references(() => Project.id, { onDelete: 'set null' }),
  parentFolderId: integer().references((): AnyPgColumn => Folder.id, {
    onDelete: 'set null',
  }),
  ...timestamps,
});

export type FolderType = InferSelectModel<typeof Folder>;
export type FolderTypeIn = InferInsertModel<typeof Folder>;
export const FolderSelSchema = createSelectSchema(Folder);
export const FolderInSchema = createInsertSchema(Folder);
export const FolderUpSchema = createUpdateSchema(Folder);
