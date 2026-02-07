# Security Policy

## Supported Versions

We release patches for security vulnerabilities in the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of CodeGuardian seriously. If you believe you have found a security vulnerability, please report it to us as described below.

### How to Report

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please use one of the following methods:

1. **GitHub Security Advisories** (preferred): Use the [GitHub private vulnerability reporting feature](https://github.com/ersinkoc/codeguardian/security/advisories/new)
2. **Email**: Send an email to the maintainer at ersinkocc@gmail.com with the subject line "SECURITY: CodeGuardian Vulnerability Report"

### What to Include

Please include the following information in your report:

- Type of issue (e.g., code injection, path traversal, denial of service)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

### Response Timeline

- **Initial Response**: Within 48 hours, we will acknowledge receipt of your vulnerability report
- **Status Update**: Within 7 days, we will provide a detailed response indicating the next steps
- **Fix Timeline**: We aim to release patches for confirmed vulnerabilities within 30 days, depending on complexity

## What Counts as a Security Issue

For CodeGuardian, security issues include but are not limited to:

### High Priority
- **Code Injection**: Vulnerabilities that could allow malicious code execution during analysis
- **Path Traversal**: Bugs that could allow reading files outside the intended project directory
- **Denial of Service**: Issues that could crash the tool or consume excessive system resources
- **Configuration File Injection**: Vulnerabilities in parsing `.codeguardianrc.json` or other config files
- **Plugin System Exploits**: Vulnerabilities in the plugin loading or execution mechanism

### Medium Priority
- **Information Disclosure**: Unintended exposure of sensitive file contents or system information
- **Regular Expression DoS**: ReDoS vulnerabilities in pattern matching
- **Dependency Vulnerabilities**: Critical security issues in TypeScript or other dependencies

### Not Considered Security Issues
- Performance issues that don't constitute denial of service
- Bugs in analysis results or false positives/negatives
- Feature requests or general bug reports
- Issues requiring physical access to the machine
- Issues in unsupported versions

## Disclosure Policy

We follow a **coordinated disclosure** process:

1. **Private Disclosure**: Security researchers report vulnerabilities privately
2. **Investigation**: We investigate and develop fixes in private
3. **Patch Release**: We release patched versions
4. **Public Disclosure**: After patches are available, we publish a security advisory with credit to the reporter (unless they prefer to remain anonymous)

We ask that security researchers:
- Give us reasonable time to fix vulnerabilities before public disclosure (minimum 30 days)
- Avoid exploiting the vulnerability or sharing it with others
- Make a good faith effort to avoid privacy violations and data destruction

## Security Considerations for Users

CodeGuardian is designed with security in mind:

### What CodeGuardian Does
- **Static Analysis Only**: Parses and analyzes TypeScript/JavaScript code without executing it
- **Local Execution**: Runs entirely on your local machine
- **Zero Network Dependencies**: Makes no network requests or external API calls
- **File System Access**: Only reads files within the specified project directory

### Best Practices
- **Keep Updated**: Always use the latest stable version to benefit from security patches
- **Review Configuration**: Audit your `.codeguardianrc.json` and custom plugin configurations
- **Trusted Sources**: Only use plugins from trusted sources
- **CI/CD Integration**: When running in CI/CD, ensure appropriate file system permissions
- **Sensitive Data**: Be aware that analysis reports may reference code snippets; handle reports appropriately if analyzing proprietary code

### Known Limitations
- CodeGuardian relies on TypeScript's compiler API for parsing; vulnerabilities in TypeScript itself may affect CodeGuardian
- Custom plugins run with the same permissions as CodeGuardian; only use trusted plugins
- Very large codebases may consume significant memory during analysis

## Security Updates

Security updates will be released as patch versions (e.g., 1.0.1, 1.0.2) and announced via:
- GitHub Security Advisories
- Release notes on GitHub
- npm package release notes

Subscribe to the repository to receive notifications of security advisories.

## Acknowledgments

We appreciate the security research community's efforts to responsibly disclose vulnerabilities. Security researchers who report valid vulnerabilities will be credited in our security advisories (unless they prefer anonymity).

---

**Last Updated**: February 2026
**Project Maintainer**: Ersin Koç
**Repository**: https://github.com/ersinkoc/codeguardian
