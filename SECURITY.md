# Security Policy & Maintenance

Maintaining a secure application is an ongoing process. This document outlines how to manage dependencies and handle security audits for **DevNotes**.

## 🛡️ Dependency Management

To prevent supply chain attacks, all dependencies in `package.json` are **pinned to exact versions**. This ensures that the application only runs code that has been verified.

### Updating Dependencies
When you need to update a package, do not use range markers like `^` or `~`. Instead:

1.  Find the target version (e.g., `npm info clerk-react versions`).
2.  Update the version number directly in `package.json`.
3.  Run `npm install`.
4.  Run the security audit (see below).

## 🔍 Security Auditing

We have added a custom script to simplify security checks.

### Routine Audit
Run this command regularly to check for known vulnerabilities in your installed packages:

```bash
npm run security-check
```

This command runs `npm audit` with a "High" severity threshold. If it finds critical issues, you should update the affected package immediately.

## 🧱 Content Security Policy (CSP)

DevNotes uses **Helmet** to enforce a Content Security Policy. This protects the app from:
- **XSS (Cross-Site Scripting)**: Preventing malicious scripts from running in the browser.
- **Unauthorized Data Exfiltration**: Ensuring data is only sent to trusted servers.

### Trusted Sources
The policy is currently configured to allow:
- **Clerk**: Authentication and user management.
- **Google Fonts**: Inter and JetBrains Mono typography.
- **Lucide Icons**: Internal SVG assets.

If you add a new external service (e.g., an analytics tool or a different font provider), you must update the `directives` in `server/index.ts` to include the provider's domain.

## 🚨 Reporting Vulnerabilities

If you discover a security vulnerability within this project, please open an issue in the repository or contact the maintainer directly.
