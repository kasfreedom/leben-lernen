# Leben lernen prototype

A small offline-first bilingual practice application for the BAMF `Leben in Deutschland` question catalog.

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

## Architecture

- `src/domain/types.ts`: stable interfaces shared by every layer
- `src/domain/practice-engine.ts`: question lookup and scoring; contains no UI or translated text
- `src/content/questions.de.ts`: authoritative German source questions
- `src/content/support.en.ts`: replaceable English learning-support pack
- `src/main.ts`: browser UI and local interaction state
- `src/styles.css`: responsive visual system

New support languages should be added as separate content modules implementing `LearningSupport`. Progress and scoring use question and choice identifiers, so changing or adding translations does not invalidate learner history.

## Prototype scope

The current prototype contains seven verified sample questions: five nationwide questions and two Bavaria questions. It demonstrates question navigation, bilingual support, vocabulary, German patterns, answer checking, feedback, and responsive behavior. Importing and verifying the complete 310-question Bavaria dataset is the next content milestone.

## Design verification

- Visual concept: `design/learning-screen-concept.png`
- Desktop implementation capture: `design/implementation-desktop-flat.png`
- Mobile implementation capture: `design/implementation-mobile-flat.png`

