# Leben lernen

Mobile-first practice app for the German `Leben in Deutschland` citizenship-test question catalog.

Open the app:

[https://kasfreedom.github.io/leben-lernen/](https://kasfreedom.github.io/leben-lernen/)

## What it does

- Practice all 310 Bavaria-relevant questions.
- Train with translated question support.
- Review vocabulary and German sentence patterns.
- Take mock exams with the official-style 30 general + 3 regional question mix.
- Track progress, wrong answers, bookmarks, and language drills in the browser.

## Languages

App/interface languages:

- German
- English
- Russian
- Arabic

Question/support translations:

- English
- Russian
- Arabic

Language data is file-based. Adding another support language should only require a new JSON file plus a manifest entry.

See [docs/language-packs.md](docs/language-packs.md) for the language-pack contract.

## Run locally

```sh
npm install
npm run dev
```

Quality checks:

```sh
npm test
npm run build
```

## Project structure

- `public/data/exams/leben-in-deutschland/`: question catalog and support-language JSON files
- `public/data/ui/`: app/interface language JSON files
- `src/domain/`: practice, scoring, and language-practice logic
- `src/data/`: static JSON loading
- `src/i18n/`: UI translation helpers
- `src/main.ts`: browser UI and interaction state
- `tests/`: catalog, i18n, navigation, and practice-engine checks

## Deployment

The app is a static Vite site and can be hosted on GitHub Pages.

