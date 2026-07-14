# Language pack contract

The app treats question-support languages as data.

## Rules

- One support language equals one JSON file in `public/data/exams/leben-in-deutschland/support/`.
- File names use the locale id: `en.json`, `ar.json`, `ru.json`.
- No draft files are part of the app data model.
- No language-specific runtime code is needed for a new support language.
- No language-specific validation script should be added.
- A support language is available in the UI only when it is listed in `public/data/exams/leben-in-deutschland/manifest.json`.
- Do not expose a language in `manifest.json` until the full JSON file exists and is usable.

## Adding a support language

1. Add the full JSON file, for example `support/ru.json`.
2. Add the locale to `manifest.json`:

   ```json
   {
     "id": "ru",
     "label": "Русский",
     "supportPath": "support/ru.json"
   }
   ```

3. Run the generic tests. The tests validate all support languages listed in the manifest.

## Support entry shape

Each entry must keep the same structure as the existing language packs:

```json
{
  "questionId": "general-1",
  "locale": "ru",
  "translation": "...",
  "correctAnswerTranslation": "...",
  "simpleExplanation": "...",
  "vocabulary": [
    { "source": "dürfen", "translation": "..." }
  ],
  "germanPattern": {
    "pattern": "etwas gegen ... sagen",
    "meaning": "..."
  }
}
```

`germanPattern` is optional and should be present only when useful.

## Interface languages

Interface languages are separate from support languages:

- UI strings live in `public/data/ui/*.json`.
- UI languages are listed in `public/data/ui/manifest.json`.
- Support languages are listed in the exam manifest.

This separation is intentional. A learner can use German UI with Russian question support, or another combination.

## Translation source

The app does not need build-time code for a new support language. The only required artifact is the JSON file.

If machine translation is used to create that JSON, explicitly approve the external translation service first because the question text is sent outside the local workspace. Without that approval, add a reviewed full JSON file directly.
