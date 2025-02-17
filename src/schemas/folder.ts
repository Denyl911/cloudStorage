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

export const Folder = pgTable('folders', {
  id: serial().primaryKey(),
  name: varchar().notNull(),
  userId: integer()
    .notNull()
    .references(() => User.id),
  parentFolderId: integer().references((): AnyPgColumn => Folder.id),
  ...timestamps,
});

export type FolderType = InferSelectModel<typeof Folder>;
export type FolderTypeIn = InferInsertModel<typeof Folder>;
export const FolderSelSchema = createSelectSchema(Folder);
export const FolderInSchema = createInsertSchema(Folder);
export const FolderUpSchema = createUpdateSchema(Folder);
