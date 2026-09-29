# Signal shipping instructions

George's instruction on 2026-09-29: stop the automatic GitHub checks and the
wait for them on routine Signal changes.

- Keep `.github/workflows/build.yml` manual (`workflow_dispatch`) only.
- Do not trigger or wait for the GitHub Build checks unless George explicitly
  asks for them. Do not re-enable automatic checks without his direction.
- Use focused local checks for the changed behavior and the build needed to
  install the update. Verification should fit the change.
- This project instruction overrides a shipping skill's default to wait for
  CI. Record the actual local proof and finish once the requested update is
  installed and any authorized commit/push is complete.
