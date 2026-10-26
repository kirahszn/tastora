# Tastora

> Good food should still feel like home.

Tastora is a caregiver-facing web app for finding restaurant meals that match the tastes of an older person you care for. A caregiver describes the person's food tastes and explicit food constraints; Tastora will use Qloo's taste intelligence to find real New York City restaurants, rank and explain them, and clearly flag anything it cannot verify (such as allergens or texture). Built for the Qloo Agentic Hackathon 2026.

**Status: in development.** Only the project skeleton, a placeholder home page, and a health-check endpoint exist so far.

## Setup

Requires Node.js 20 or newer.

```bash
git clone <repo-url>
cd tastora
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

Open <http://localhost:3000>. API keys are read server-side only and must never be committed.

## Scripts

| Script              | What it does                         |
| ------------------- | ------------------------------------ |
| `npm run dev`       | Start the development server         |
| `npm run build`     | Create a production build            |
| `npm start`         | Serve the production build           |
| `npm run lint`      | Run ESLint                           |
| `npm run typecheck` | Type-check with `tsc --noEmit`       |
| `npm test`          | Run the Vitest test suite once       |

## Licence

Released under the [MIT License](LICENSE).
