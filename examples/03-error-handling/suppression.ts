/**
 * Example: Using inline suppression comments.
 *
 * codeguardian supports three types of inline suppression:
 * 1. Disable next line
 * 2. Disable region (block)
 * 3. Enable (re-enable after disable)
 */

// Suppress a single rule on the next line
// codeguardian-disable-next-line security/sql-injection
const legacyQuery = `SELECT * FROM users WHERE id = ${123}`;

// Suppress with a reason (for documentation)
// codeguardian-disable security/hardcoded-secret -- used only in tests
const testApiKey = 'secret_test_abc123def456ghi789';
// codeguardian-enable security/hardcoded-secret

export { legacyQuery, testApiKey };
