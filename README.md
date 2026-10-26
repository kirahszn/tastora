# Tastora

> Good food should still feel like home.

Tastora is a caregiver-facing web app for finding restaurant meals that match the tastes of an older person you care for. A caregiver describes the person's food tastes and explicit food constraints; Tastora will use Qloo's taste intelligence to find real New York City restaurants, rank and explain them, and clearly flag anything it cannot verify (such as allergens or texture). Built for the Qloo Agentic Hackathon 2026.

**Status: in development.** The recommendation API (`POST /api/recommend`: Claude plans the Qloo searches, Tastora's own code checks constraints, ranks and explains) and a health check exist; there is no UI yet. See `docs/agent.md`.

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
| `npm run smoke:recommend` | Live end-to-end run for two sample profiles (uses API credit) → `docs/phase3-smoke.md` |

## Licence

Released under the [MIT License](LICENSE).
