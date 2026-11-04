# Contributing

Thanks for taking a look. Issues and PRs are welcome.

- One PR per feature, kept small.
- Every PR runs the eval gate (once the harness ships) and must stay green.
- Never commit secrets or real data. Use `.env.example` and synthetic fixtures. Install the hook: `pre-commit install` (uses gitleaks).
- Tailwind defaults, no custom design. Ship ugly, then iterate.

Setup: Node 22+, pnpm 10, `pnpm install`.

By contributing you agree your work is released under the MIT license.
