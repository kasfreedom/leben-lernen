# Leben lernen

Mobile-first practice app for the German `Leben in Deutschland` citizenship-test question catalog.

## About

Leben lernen helps learners prepare for the German citizenship-test question catalog with focused practice, translated support, vocabulary review, and mock exams.

Live app: [kasfreedom.github.io/leben-lernen](https://kasfreedom.github.io/leben-lernen/)

The app is a static browser application. It stores progress locally in the browser and keeps question/support content as JSON data files.

## Features

- Practice all 310 Bavaria-relevant questions.
- Show translated question support while studying.
- Review vocabulary and German sentence patterns.
- Take mock exams with an official-style 30 general + 3 regional question mix.
- Track progress, wrong answers, bookmarks, and language drills locally.

## Languages

Interface languages:

- German
- English
- Russian
- Arabic

Question/support translations:

- English
- Russian
- Arabic

Language support is data-driven. Adding a new support language should only require a JSON file and a manifest entry.

See [docs/language-packs.md](docs/language-packs.md) for the language-pack contract.

## Development

Install dependencies:

```sh
npm install
```

Run the local dev server:

```sh
npm run dev
```

Run checks:

```sh
npm test
npm run build
```

## Project structure

- `public/data/exams/leben-in-deutschland/`: question catalog and support-language JSON files
- `public/data/ui/`: app/interface language JSON files
- `data/`: source extraction and answer-key working files
- `source/`: official source PDF archive
- `src/domain/`: practice, scoring, and language-practice logic
- `src/data/`: static JSON loading
- `src/i18n/`: UI translation helpers
- `src/main.ts`: browser UI and interaction state
- `tests/`: catalog, i18n, navigation, and practice-engine checks

## Deployment

The app is deployed as a static Vite site on GitHub Pages. The deployment workflow builds the root project and publishes the generated `dist/` directory.
