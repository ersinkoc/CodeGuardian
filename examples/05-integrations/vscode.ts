/**
 * Example: VS Code task integration.
 *
 * Add this to your .vscode/tasks.json:
 *
 * ```json
 * {
 *   "version": "2.0.0",
 *   "tasks": [
 *     {
 *       "label": "CodeGuardian: Analyze",
 *       "type": "shell",
 *       "command": "npx codeguardian run --verbose",
 *       "problemMatcher": [],
 *       "group": "test"
 *     },
 *     {
 *       "label": "CodeGuardian: Stats",
 *       "type": "shell",
 *       "command": "npx codeguardian stats",
 *       "problemMatcher": [],
 *       "group": "test"
 *     }
 *   ]
 * }
 * ```
 */
export {};
