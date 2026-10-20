# UI & Architecture Specification: Sample Feature

## 1. Platform & Scope
- **Platform:** Web & Mobile
- **Scope:** `src/features/sample-feature/`
- **Theme Tokens:** Primary Indigo `#4F46E5`, Background Slate `#0F172A`, Text White `#FFFFFF`.

## 2. Mobile Ergonomics
- Safe Area Insets: Yes
- Touch Target: $\ge 48\text{dp}$
- Navigation: Stack view

## 3. Presentational Component Tree
- `SampleCard`:
  - Props: `{ title: string, value: number, isPositive: boolean }`
  - Layout: Flex column, rounded-xl, p-4, shadow-md.

## 4. Types & Schema
```typescript
export interface SampleData {
  id: string;
  title: string;
  value: number;
}
```
