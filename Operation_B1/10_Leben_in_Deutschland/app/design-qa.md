source visual truth path: /Users/kassem/.codex/generated_images/019f5b2d-703f-7063-80f1-395612d1492e/call_dnPeDFWz4mg8kPOFjmL2EIRC.png
implementation screenshot path: /private/tmp/leben-lernen-mobile-ui-compact.png
viewport: 390 x 844 mobile emulation
state: Practice screen, translation visible, settings closed
full-view comparison evidence: source mock and implementation screenshot inspected visually; browser DOM verified 390px inner width and no horizontal overflow
focused region comparison evidence: header/settings, progress/question area, translation/key words, answers, and bottom navigation inspected through DOM metrics and screenshot

**Findings**
- No P0/P1/P2 blockers remain for this iteration.

**Comparison History**
- Initial mobile implementation kept the practice set toolbar in the main viewport, leaving the question too low. Fixed by moving practice set into the mobile settings gear and hiding the normal practice toolbar on mobile.
- Initial mobile implementation left the translation toggle above the German question. Fixed by moving the toggle below the question so the prompt becomes the primary content.
- Browser screenshot capture shows blank space to the right because of the capture surface, but browser DOM metrics report `window.innerWidth = 390`, `documentElement.scrollWidth = 390`, and `horizontalOverflow = false`.

**Required Fidelity Surfaces**
- Fonts and typography: German question uses the same serif-led hierarchy as the selected mock. Mobile question font renders at 39px in the checked state.
- Spacing and layout rhythm: top settings controls are removed from the main viewport; topbar is 69px; question begins at 202px in the verified mobile state.
- Colors and visual tokens: mobile active/accent styling is blue-based, matching the selected option 2 color direction.
- Image quality and asset fidelity: no raster assets are required for this UI; icons are simple UI controls already present in the app.
- Copy and content: app language, question translation, region, and practice set are moved into the settings gear; translation and key words remain visible in the study flow.

**Open Questions**
- The mock shows answer choices more fully above the bottom nav. In the current real app, long German prompts and saved progress can push answers lower. This is acceptable for now but can be tightened further if desired.

**Implementation Checklist**
- Mobile settings gear replaces always-visible app/question language controls.
- Mobile practice set selector is available inside settings, not in the main flow.
- German question is visually prioritized.
- Translation and key words are shown as compact study blocks.
- Bottom navigation remains available.

final result: passed
