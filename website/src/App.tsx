import { useState, useCallback } from 'react';

function CodeBlock({ code, language = 'bash' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [code]);

  const lines = code.split('\n');

  return (
    <pre>
      <button className="copy-btn" onClick={handleCopy}>
        {copied ? 'Copied!' : 'Copy'}
      </button>
      <code>
        {lines.map((line, i) => (
          <span key={i}>
            <span style={{ color: 'var(--text-secondary)', marginRight: 16, userSelect: 'none' }}>
              {String(i + 1).padStart(2)}
            </span>
            {line}
            {'\n'}
          </span>
        ))}
      </code>
    </pre>
  );
}

export default function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  return (
    <>
      <button className="theme-toggle" onClick={toggleTheme}>
        {theme === 'dark' ? 'Light' : 'Dark'}
      </button>

      <div className="container">
        <div className="hero">
          <h1>@oxog/codeguardian</h1>
          <p className="subtitle">
            Zero-dependency TypeScript codebase guardian. Pre-commit hook enforcing
            architecture, security, performance, and quality rules.
          </p>
          <div
            className="install-cmd"
            onClick={() => navigator.clipboard.writeText('npm install @oxog/codeguardian --save-dev')}
            title="Click to copy"
          >
            npm install @oxog/codeguardian --save-dev
          </div>
        </div>

        <div className="features">
          <div className="feature">
            <h3>Knowledge Graph</h3>
            <p>
              Builds an in-memory graph of your entire codebase — files, symbols,
              imports, dependencies, and architectural layers.
            </p>
          </div>
          <div className="feature">
            <h3>29 Built-in Rules</h3>
            <p>
              Architecture violations, SQL injection, hardcoded secrets, N+1 queries,
              dead code, and much more — all out of the box.
            </p>
          </div>
          <div className="feature">
            <h3>Zero Dependencies</h3>
            <p>
              No lodash, no chalk, no commander. Everything built from scratch.
              Only TypeScript as a peer dependency.
            </p>
          </div>
          <div className="feature">
            <h3>Incremental &amp; Fast</h3>
            <p>
              Caches the knowledge graph. Pre-commit analysis runs in under 2 seconds
              by only re-parsing changed files.
            </p>
          </div>
          <div className="feature">
            <h3>Plugin System</h3>
            <p>
              Micro-kernel architecture. All rules live in plugins. Create your own
              rules and plugins with a simple API.
            </p>
          </div>
          <div className="feature">
            <h3>Multiple Outputs</h3>
            <p>
              Terminal with colors, JSON for CI/CD, SARIF for GitHub Code Scanning.
              Severity-based commit control.
            </p>
          </div>
        </div>

        <section>
          <h2>Quick Start</h2>
          <CodeBlock
            code={`npm install @oxog/codeguardian --save-dev
npx codeguardian init`}
          />
          <p style={{ marginTop: 16, color: 'var(--text-secondary)' }}>
            This installs the pre-commit hook, creates the config file, and runs the
            first scan.
          </p>
        </section>

        <section>
          <h2>Programmatic API</h2>
          <CodeBlock
            language="typescript"
            code={`import { createGuardian } from '@oxog/codeguardian';

const guardian = createGuardian({
  rootDir: process.cwd(),
  tsconfig: './tsconfig.json',
});

// Full scan
const graph = await guardian.scan();
console.log(\`\${graph.files.size} files scanned\`);

// Run analysis on staged files
const result = await guardian.run({ staged: true });
if (result.blocked) {
  process.exit(1);
}`}
          />
        </section>

        <section>
          <h2>Custom Rules</h2>
          <CodeBlock
            language="typescript"
            code={`import { defineRule } from '@oxog/codeguardian';

const noConsole = defineRule({
  name: 'custom/no-console',
  severity: 'warning',
  description: 'No console.log in production',
  category: 'quality',
  check: (ctx) => {
    const findings = [];
    ctx.walk(ctx.ast, {
      CallExpression(node) {
        if (ctx.isConsoleCall(node, 'log')) {
          findings.push({
            message: 'Remove console.log',
            file: ctx.file.path,
            line: 1, column: 1,
          });
        }
      },
    });
    return findings;
  },
});`}
          />
        </section>

        <section>
          <h2>Core Plugins</h2>
          <table>
            <thead>
              <tr>
                <th>Plugin</th>
                <th>Rules</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>architecture</code></td>
                <td>6</td>
                <td>Layer violations, circular deps, god files/functions</td>
              </tr>
              <tr>
                <td><code>security</code></td>
                <td>8</td>
                <td>SQL injection, secrets, eval, XSS, path traversal</td>
              </tr>
              <tr>
                <td><code>performance</code></td>
                <td>7</td>
                <td>N+1 queries, sync ops, memory leaks, blocking</td>
              </tr>
              <tr>
                <td><code>quality</code></td>
                <td>8</td>
                <td>Complexity, dead code, any type, empty catch</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2>Severity Levels</h2>
          <table>
            <thead>
              <tr>
                <th>Level</th>
                <th>Blocks Commit</th>
                <th>Display</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ color: 'var(--red)' }}>critical</td>
                <td>Yes</td>
                <td>Always shown</td>
              </tr>
              <tr>
                <td style={{ color: 'var(--red)' }}>error</td>
                <td>Yes</td>
                <td>Always shown</td>
              </tr>
              <tr>
                <td style={{ color: 'var(--yellow)' }}>warning</td>
                <td>No</td>
                <td>Always shown</td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text-secondary)' }}>info</td>
                <td>No</td>
                <td>Only with --verbose</td>
              </tr>
            </tbody>
          </table>
        </section>

        <footer>
          <p>
            MIT License &middot; Ersin Koc &middot;{' '}
            <a href="https://github.com/ersinkoc/codeguardian">GitHub</a>
          </p>
        </footer>
      </div>
    </>
  );
}
