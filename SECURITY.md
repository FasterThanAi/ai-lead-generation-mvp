# Security Policy

## Supported versions

Only the latest code on the `main` branch receives security fixes.

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report them privately instead:

1. Go to the **Security** tab of this repository.
2. Click **Report a vulnerability**.
3. Describe the problem, the affected file or endpoint, and the steps to reproduce it.

We aim to reply within 7 days and will keep you updated until the issue is fixed.

## What to report

- Leaked credentials, API keys or tokens in the code or git history
- Ways to read or change data without permission
- Injection issues (SQL, prompt injection that leaks data, command injection)
- Ways to send email or start calls without the user approving them

## Keeping secrets safe

This project talks to several paid services (Gemini, Gmail, Hunter.io, Apollo, Vapi, n8n). When contributing:

- Keep real keys in your local `.env` files only. They are git-ignored.
- Use `.env.example` for variable **names**, never real values.
- If you commit a secret by accident, tell a maintainer straight away so it can be rotated. Deleting the commit is not enough, because the key stays in git history.

## Incident: malicious code in a contributor PR (November 2026)

PR #154 (commit `203fd38`, "add Objection Handling entry to knowledge sample") also
changed `frontend/tailwind.config.js`. After the closing `};` it appended ~900 tab
characters followed by obfuscated JavaScript, so the code sat off-screen in editors
and in GitHub's diff view. Because `src/index.css` loads that file with `@config`,
the payload ran on **every** `npm run dev` and `npm run build`. The same change was
made to `submission_1/source-code/frontend/tailwind.config.js`.

What it did when it ran:

- contacted `95.135.181.84:80`, sending the machine hostname and username;
- downloaded and executed further code (`node -e …`, and a `python -c …` child);
- installed `socket.io-client` and a loader in `~/.node_modules/`
  (`.npm-ws-runner.js`, `.npm-ws.json`, `.npm-ws.pid`) that fetches and evals code.

Fixed in this branch by restoring both config files to their pre-`203fd38` content.

**If you ran `npm run dev` or `npm run build` on any commit from `203fd38` onwards:**

1. Look for running processes: `ps aux | grep -E "npm-ws|95\.135\.181\.84|global\['_V'\]"` and kill them.
2. Delete `~/.node_modules/` (note the leading dot in the folder name; this is not a project folder).
3. Assume secrets readable by your user account are exposed and rotate them: GitHub and npm
   tokens, SSH keys, cloud credentials, browser sessions, and every key in this project's
   `.env` files (Gemini, Gmail OAuth, Hunter, Apollo, Vapi, database URL).
4. Run a malware scanner.

Prevention now in place:

- `scripts/security_scan.py` runs first in CI and fails on hidden whitespace runs,
  obfuscator identifiers, `global['…']` assignments and dynamic code execution in
  build config files. It flags the original payload on five separate rules.
- CI and the Docker build install dependencies with `npm ci --ignore-scripts`.
- Review tip: on GitHub use "Hide whitespace" off and check the file list. A PR that
  says "sample data" but touches a build config file needs a closer look.
