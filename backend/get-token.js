/**
 * Usage:
 *   node get-token.js superadmin@example.com SuperPass123!
 *   node get-token.js seed@example.com Passw0rd!
 *
 * Prints the ID token for the emulator user.
 */

const [emailArg, passwordArg] = process.argv.slice(2);
const email = emailArg || 'seed@example.com';
const password = passwordArg || 'Passw0rd!';

const fetchFn = global.fetch || require('node-fetch');

const payload = { email, password, returnSecureToken: true };
const url = 'http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-key';

fetchFn(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
})
  .then((r) => r.json())
  .then((j) => {
    if (j.idToken) {
      console.log(j.idToken);
    } else {
      console.error('Failed to get token', j);
      process.exit(1);
    }
  })
  .catch((e) => {
    console.error('Error', e);
    process.exit(1);
  });
