import { pgTable, integer, text, timestamp } from 'drizzle-orm/pg-core';
import { User } from './user';
import { InferSelectModel } from 'drizzle-orm';

export const Session = pgTable('sessions', {
  id: text().primaryKey(),
  userId: integer()
    .notNull()
    .references(() => User.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', {
    withTimezone: true,
    mode: 'date',
  }).notNull(),
});

export type SessionType = InferSelectModel<typeof Session>;
