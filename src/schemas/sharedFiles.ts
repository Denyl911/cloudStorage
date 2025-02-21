import { pgTable, integer, primaryKey, boolean } from 'drizzle-orm/pg-core';
import { User } from './user';
import { InferSelectModel } from 'drizzle-orm';
import { Folder } from './folder';
import { File } from './file';
import { createInsertSchema } from 'drizzle-typebox';

export const SharedFile = pgTable(
  'shared_files',
  {
    userId: integer()
      .notNull()
      .references(() => User.id, { onDelete: 'cascade' }),
    fileId: integer()
      .notNull()
      .references(() => File.id, { onDelete: 'cascade' }),
    root: boolean().default(false),
  },
  (t) => [primaryKey({ columns: [t.userId, t.fileId] })]
);

export const SharedFolder = pgTable(
  'shared_folders',
  {
    userId: integer()
      .notNull()
      .references(() => User.id, { onDelete: 'cascade' }),
    folderId: integer()
      .notNull()
      .references(() => Folder.id, { onDelete: 'cascade' }),
    root: boolean().default(false),
  },
  (t) => [primaryKey({ columns: [t.userId, t.folderId] })]
);

export type SharedFileType = InferSelectModel<typeof SharedFile>;
export const SharedFileInSchema = createInsertSchema(SharedFile);
export const SharedFolderInSchema = createInsertSchema(SharedFolder);
