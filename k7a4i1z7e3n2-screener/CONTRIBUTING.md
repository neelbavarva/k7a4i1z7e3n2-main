# Contributing to KAIZEN Screener

Thank you for your interest in contributing to KAIZEN Screener!

## Workflow

1. Fork or clone the repository.
2. Create a feature branch: `git checkout -b feature/my-feature`.
3. Ensure all code passes type-checking and production build:
   ```bash
   npm run build
   ```
4. Commit your changes with clear, descriptive commit messages.
5. Push to your branch and open a Pull Request.

## Coding Standards

- Keep domain engines in `lib/` pure and framework-independent.
- Avoid introducing inline secrets or unnecessary dependencies.
- Ensure TypeScript strict mode compliance.
