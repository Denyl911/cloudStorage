import { integer, pgTable, serial, varchar } from 'drizzle-orm/pg-core';
import timestamps from './columns.helpers';
import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { Folder } from './folder';
import { createSelectSchema } from 'drizzle-typebox';
import { t } from 'elysia';
import { User } from './user';

export const File = pgTable('files', {
  id: serial().primaryKey(),
  name: varchar().notNull(),
  route: varchar().notNull(),
  userId: integer()
    .notNull()
    .references(() => User.id, { onDelete: 'cascade' }),
  folderId: integer()
    .notNull()
    .references(() => Folder.id, { onDelete: 'cascade' }),
  ...timestamps,
});

export type FileType = InferSelectModel<typeof File>;
export type FileTypeIn = InferInsertModel<typeof File>;
export const FileSelSchema = createSelectSchema(File);
export const FileInSchema = t.Object({
  file: t.File(),
  userId: t.Integer(),
  folderId: t.Integer(),
});
export const FileUpSchema = t.Object({
  name: t.String(),
});
