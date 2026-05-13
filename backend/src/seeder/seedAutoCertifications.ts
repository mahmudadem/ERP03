/**
 * Seed auto-certifications for well-known AI models.
 *
 * This script is designed to be called during system startup or via a seed command.
 * It uses AiAutoSeedCertification to create CERTIFIED results for well-known
 * models (GPT-4o, Claude 3.5, Gemini, etc.) so tenants who select these models
 * get tool access without manual certification.
 *
 * Idempotent — running multiple times creates no duplicates.
 */

import { diContainer } from '../infrastructure/di/bindRepositories';

export async function seedAutoCertifications(): Promise<number> {
  const seedService = diContainer.aiAutoSeedCertification;
  const count = await seedService.seed();
  if (count > 0) {
    console.log(`[AI Auto-Certification] Seeded ${count} auto-certification(s) for well-known models.`);
  } else {
    console.log('[AI Auto-Certification] All well-known models already certified. No new certifications needed.');
  }
  return count;
}

// Allow running standalone
if (require.main === module) {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
  process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'erp-03';

  seedAutoCertifications()
    .then((count) => {
      console.log(`Done. ${count} certification(s) created.`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('Auto-certification seeding failed:', error);
      process.exit(1);
    });
}