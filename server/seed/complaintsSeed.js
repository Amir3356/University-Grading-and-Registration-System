import { query } from '../config/database.js';

export async function seedComplaints() {
  // Clear any existing complaints as requested: removed all data rows
  await query('DELETE FROM complaints');
  console.log('Complaints table cleared (0 complaints).');
}

if (process.argv[1]?.endsWith('complaintsSeed.js')) {
  seedComplaints()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
