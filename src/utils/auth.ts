import { randomUUIDv7 } from 'bun';
import db from '../config/db.config';
import { Session, SessionType } from '../schemas/session';
import { User, UserType } from '../schemas/user';
import { eq } from 'drizzle-orm';
import {
  DAY_MS,
  SESSION_RENEW_THRESHOLD_DAYS,
  SESSION_TTL_DAYS,
} from '../config/session.config';

/**
 * Crea una nueva sesión para un usuario.
 * El token (UUIDv7) se devuelve en texto plano y se guarda hasheado con SHA-256.
 */
export async function createSession(userId: number): Promise<SessionType> {
  const token = randomUUIDv7();
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(token);
  const sessionId = hasher.digest('hex');
  const session: SessionType = {
    id: sessionId,
    userId,
    expiresAt: new Date(Date.now() + SESSION_TTL_DAYS * DAY_MS),
  };
  await db.insert(Session).values(session);
  return session;
}

/**
 * Valida el token de sesión y devuelve el usuario dueño.
 * Devuelve `null` si la sesión no existe o expiró (y la elimina),
 * y renueva la expiración si está dentro de la ventana de renovación.
 */
export async function validateSessionToken(
  token: string
): Promise<UserType | null> {
  const result = await db
    .select({ user: User, session: Session })
    .from(Session)
    .innerJoin(User, eq(Session.userId, User.id))
    .where(eq(Session.id, token));
  if (result.length < 1) {
    return null;
  }
  const { user, session } = result[0];
  if (Date.now() >= session.expiresAt.getTime()) {
    await db.delete(Session).where(eq(Session.id, session.id));
    return null;
  }
  if (
    Date.now() >=
    session.expiresAt.getTime() - SESSION_RENEW_THRESHOLD_DAYS * DAY_MS
  ) {
    session.expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * DAY_MS);
    await db
      .update(Session)
      .set({
        expiresAt: session.expiresAt,
      })
      .where(eq(Session.id, session.id));
  }
  return user;
}

/** Invalida (elimina) una sesión por id. */
export async function invalidateSession(sessionId: string): Promise<void> {
  await db.delete(Session).where(eq(Session.id, sessionId));
}

/** Invalida todas las sesiones de un usuario. */
export async function invalidateAllSessions(userId: number): Promise<void> {
  await db.delete(Session).where(eq(Session.userId, userId));
}
