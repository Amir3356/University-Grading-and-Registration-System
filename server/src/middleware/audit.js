import { newId } from '../utils/idGenerator.js';
import { query } from '../config/database.js';

export async function logAudit(dbOrClient, {
  userId = null,
  action,
  entityType,
  entityId,
  offeringId = null,
  details,
  reason = null,
  before = null,
  after = null,
  ipAddress = null,
}) {
  const runner = dbOrClient.query ? dbOrClient : { query };
  const id = newId('aud');

  await runner.query(
    `INSERT INTO audit_logs (
       id, user_id, action, entity_type, entity_id, offering_id,
       details, reason, before, after, ip_address, created_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())`,
    [
      id,
      userId,
      action,
      entityType,
      entityId,
      offeringId,
      details,
      reason,
      before ? JSON.stringify(before) : null,
      after ? JSON.stringify(after) : null,
      ipAddress,
    ]
  );
  return id;
}
