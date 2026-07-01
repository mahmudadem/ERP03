import { IRealtimeDispatcher } from './IRealtimeDispatcher';
import { Notification } from '../../domain/system/entities/Notification';

/**
 * No-op realtime dispatcher.
 *
 * Used in the SQL/PostgreSQL lane, which does not use Firebase Realtime Database.
 * Notifications are still persisted through the (Prisma) notification repository;
 * only the best-effort realtime *push* is skipped.
 *
 * Why this exists: FirebaseRealtimeDispatcher calls `admin.database().ref().update()`,
 * which blocks indefinitely when no Realtime Database is configured/reachable (e.g. a
 * standalone SQL server with only the Auth emulator running). Because callers may
 * `await` the dispatch before sending their HTTP response, that hang manifests as a
 * request that never returns. In SQL mode there is no RTDB, so pushing is a no-op.
 */
export class NullRealtimeDispatcher implements IRealtimeDispatcher {
  async pushToUser(_companyId: string, _userId: string, _notification: Notification): Promise<void> {
    // intentionally no-op — SQL lane has no Firebase Realtime Database
  }

  async pushToMany(_companyId: string, _userIds: string[], _notification: Notification): Promise<void> {
    // intentionally no-op — SQL lane has no Firebase Realtime Database
  }
}
