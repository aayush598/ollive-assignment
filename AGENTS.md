<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:sudo-rules -->
# Docker & sudo

- DO NOT run `sudo` commands from bash tool — `requiretty` + `pam_faillock` causes lockout after 3 failures.
- When Docker/sudo is needed, tell the user the exact command(s) to run.
- faillock unlock: `sudo faillock --user aayush --reset`
<!-- END:sudo-rules -->
