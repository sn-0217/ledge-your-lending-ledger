# Ledge application overview

## What the app does

Ledge is a personal money and debt manager. It keeps track of money lent to
people, money borrowed, repayments, outstanding balances, and due dates. It also
has a separate tracker for participation in chitti (chitfund) plans.

The app is designed for one person's records, with local-first storage and
optional Google Drive backup. Its installable web-app experience supports
offline use for cached app content; cloud sync requires an internet connection.

## Technology

- **Language and UI:** TypeScript, React 19.
- **App framework and routing:** TanStack Start and TanStack Router, with
  file-based routes under `src/routes/`.
- **Build and development:** Vite with the Lovable TanStack configuration.
- **Styling:** Tailwind CSS 4, CSS custom properties, and `tw-animate-css`.
- **UI components:** Radix UI primitives and shadcn-style components in
  `src/components/ui/`; `lucide-react` supplies icons.
- **Data and state:** Dexie 4 over browser IndexedDB for app records; Zustand
  with persistence for preferences; TanStack Query for query caching and
  invalidation.
- **Forms and validation:** React Hook Form and Zod.
- **Charts and motion:** Recharts and Framer Motion.
- **Dates and utilities:** date-fns, `clsx`, and `tailwind-merge`.
- **Progressive Web App:** Web app manifest, icons, and a service worker in
  `public/`.

## Main areas and routes

- `/` — Dashboard with balances, lending/repayment activity, due-date
  information, and quick actions.
- `/people` — People list and search; `/people/:personId` — a person's
  categories, transactions, and balance details.
- `/chitti` — Chitti participation list; `/chitti/:chittiId` — plan details,
  monthly payments, and availed slots.
- `/analytics` — Summary metrics, charts, and lending/borrowing insights.
- `/settings` — Appearance, install guidance, backup and restore, data export
  and import, and data management.

Primary navigation links to Home, People, Chitti, Insights, and Settings. A
floating quick-add button provides access to common create actions.

## Data concepts and storage

The IndexedDB database is named `ledge-db`. Its tables are:

- **People:** names, optional contact details and notes, and tags (family,
  friends, work, or other).
- **Categories:** named groupings of a person's transactions.
- **Transactions:** amounts, dates, optional due dates and notes, with types
  `lent`, `borrowed`, `repayment_in`, and `repayment_out`.
- **Chittis:** organizer, monthly amount, duration, status, and availed-slot
  information.
- **Chitti payments:** recorded amount and date for a chitti month.

Settings are persisted separately in browser local storage. The default display
currency is Indian rupees (`₹`) with the `en-IN` locale. Google Drive backup is
an optional integration configured with `VITE_GOOGLE_CLIENT_ID`; it stores a
Ledge backup in the Drive application-data area. The Settings page offers
manual backup/restore and an auto-sync option when Drive is configured.

Local export options are JSON, CSV, and Excel; JSON backups can also be
imported. Import replaces the current local records with the validated backup.

## Visual design

- **Overall feel:** Mobile-first personal finance interface with a dark,
  high-contrast AMOLED-style default and a bright mint primary color.
- **Theme controls:** Dark or light mode plus mint, lavender, ocean, rose, and
  amber accent choices. Theme variables are defined in `src/styles.css` and
  applied by the root route.
- **Colors:** Semantic CSS tokens cover background, foreground, cards, borders,
  primary/accent, success, warning, destructive, and receive/pay states.
  Received/lent balances use the positive receive color; amounts owed use the
  pay color. Charts reuse theme tokens.
- **Typography:** Plus Jakarta Sans is loaded from Google Fonts and used as both
  the sans-serif and display family, with Inter and system sans-serif fallbacks.
  Headings use slightly tight letter spacing.
- **Surfaces:** Translucent glass-style cards, subtle radial color gradients,
  soft shadows, thin borders, rounded corners, and restrained glow/hover
  treatments. The base radius token is `1.25rem`.
- **Layout:** Content is constrained to a narrow mobile column and widens on
  desktop. Navigation sits at the bottom on mobile and across the top on wide
  screens. Safe-area insets accommodate phones.
- **Interaction details:** Lucide outline icons, animated active navigation and
  transitions, skeleton loading placeholders, status badges, dialogs, and toast
  notifications.

## Useful code map

- `src/routes/` — Route components and page-level UI.
- `src/components/layout/` — Shared app shell and navigation.
- `src/components/common/` — Reusable pieces such as glass cards and quick-add.
- `src/components/forms/` — Person, transaction, and chitti forms.
- `src/components/ui/` — Shared accessible UI primitives.
- `src/lib/types.ts` — Core record and balance types.
- `src/lib/db.ts` — IndexedDB database and schema versions.
- `src/lib/repositories.ts`, `src/lib/queries.ts` — Data access and derived
  query logic.
- `src/features/dataProvider.tsx` — React-facing data actions and queries.
- `src/features/backup/` — Local export/import and Google Drive backup/sync.
- `src/stores/settings.ts` — Persisted preferences and theme selection.
- `src/styles.css` — Theme tokens, base styles, and reusable visual utilities.

## Development commands

```sh
npm run dev
npm run build
npm run preview
npm run lint
```

Google Drive sync needs a valid `VITE_GOOGLE_CLIENT_ID` in the local environment.
See `.env.example` for the environment-variable template.
