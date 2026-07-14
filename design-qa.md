# Design QA — Streamline visual system and app icon

Date: 2026-07-14

## Scope

- Replaced handwritten/custom UI icons with real Streamline SVG assets.
- Added local visual-system fonts and design tokens.
- Updated the mobile/desktop UI styling to fit the softer Streamline-style icon direction.
- Added an optimized Brandenburg Gate favicon/app-icon asset set.
- Fixed the desktop translation toggle UX by moving the desktop control into the question tools row while keeping the mobile control near the prompt.

## Asset decisions

- Toolbar/navigation icons remain SVG because they need crisp control rendering.
- App identity uses a generated raster PNG because the selected Brandenburg Gate mark is illustrative and works better as a favicon/PWA icon than as a deterministic toolbar SVG.
- The chosen favicon direction is a simplified Brandenburg Gate with a German flag accent. It avoids the earlier generic/church-like government-building metaphor.
- Temporary icon exploration files were not kept in `public/` because they were preview-only and would otherwise deploy publicly.

## Browser checks

- Practice screen: Streamline icons load, local Nunito font loads, no horizontal overflow observed.
- Language screen: Streamline icons load, local Nunito font loads, no horizontal overflow observed.
- Desktop translation toggle: only the desktop pill is visible at desktop width; clicking it hides/shows support translation correctly.
- Mobile translation toggle: kept separate from the desktop control so the reading flow remains local to the question.
- Settings icon: replaced the old toggle-like settings asset with a Cog SVG.
- Favicon/manifest: favicon PNG and `site.webmanifest` serve correctly from the dev server.

## Commands

- `npm test` — 37 tests passed.
- `npm run build` — production build passed.

## Remaining design risk

- The generated favicon is raster, so future brand changes should start from `public/assets/app-icons/app-icon-master.png` and regenerate the derived sizes.
- A later pass should decide whether to show the app icon in the header or keep it only as browser/PWA identity.
