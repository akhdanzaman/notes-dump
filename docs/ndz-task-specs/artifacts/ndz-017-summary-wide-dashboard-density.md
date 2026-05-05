# NDZ-017 Summary wide dashboard density proof

Captured against seeded Summary/Home data at the task base SHA `d9ba0f43be1aa6e3ba1c216dfe4f0d8128ee82c7` and after the implementation branch.

## Captures
- Before 1920: `ndz-017-before-1920.png` / `ndz-017-before-1920.json`
- After 1920: `ndz-017-after-1920.png` / `ndz-017-after-1920.json`
- Before 1680: `ndz-017-before-1680.png` / `ndz-017-before-1680.json`
- After 1680: `ndz-017-after-1680.png` / `ndz-017-after-1680.json`

## Measurement summary

| Viewport | Metric | Before | After | Delta |
| --- | ---: | ---: | ---: | ---: |
| 1920x1080 | content/dashboard width | 1440px | 1536px | +96px |
| 1920x1080 | primary scan column width | 996px | 1104px | +108px |
| 1920x1080 | right context width | 416px | 400px | -16px |
| 1680x1050 | content/dashboard width | 1313px | 1313px | 0px |
| 1680x1050 | primary scan column width | 869px | 881px | +12px |
| 1680x1050 | right context width | 416px | 400px | -16px |

The Summary hierarchy and widget count are unchanged; the implementation only moves Summary to the workspace shell and retunes the existing two-column dashboard rhythm.
