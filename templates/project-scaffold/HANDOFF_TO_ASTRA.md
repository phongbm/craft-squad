# Handoff Prompt for Codex Astra (Paste into Codex App)

```text
Feature being implemented: [<FEATURE_NAME_OR_SLUG>]
Target Platform: [Web (Next.js/Tailwind) | Mobile (Flutter) | Mobile (React Native/Expo)]
PRD Requirements:
[PASTE CONTENT FROM .agents/features/<slug>/01_PRD.md HERE]

You are the Lead Cross-Platform UX/UI Architect. Design the user interface architecture for this feature.
IMPORTANT REQUIREMENTS:
1. DO NOT WRITE FULL BACKEND LOGIC OR API IMPLEMENTATIONS (to conserve token budget).
2. Generate a detailed Markdown spec to be saved in .agents/features/<slug>/02_UI_SPEC.md:
   - For WEB: Design tokens, Tailwind CSS classes, Flex/Grid layout, Props interfaces.
   - For MOBILE (Flutter / React Native): Widget tree structure, Safe Area handling, Touch targets (min 48dp), mobile navigation (Bottom tabs/Stack/Modal), styling (NativeWind/StyleSheet or ThemeData).
3. Component Breakdown: Provide Presentational Component Skeletons (pure UI markup, mock data props, no heavy state).
4. STRICTLY PROHIBITED: Do not run `git checkout` to switch branches.
5. Once written, commit with prefix: [CODEX-ASTRA](<slug>): update UI spec
```
