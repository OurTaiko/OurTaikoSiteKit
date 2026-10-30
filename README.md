# OurTaikoSiteKit

Code shared by the two OurTaiko chart sites, [Fanmade](https://github.com/OurTaiko/Fanmade) and [OurTaikoDatabase](https://github.com/OurTaiko/OurTaikoDatabase). Each site checks this repository out as the git submodule `kit/` and pins a commit; database migrations stay in the sites.

- Go module `ourtaiko.dev/sitekit` (`audio`, `constants`, `cover`, `objectstore`, `video`). A site requires it with `replace ourtaiko.dev/sitekit => ./kit`. Test here with `go test ./...`.
- `web/`: the pnpm workspace package `@ourtaiko/sitekit`, source only. A site lists `../kit/web` in its `pnpm-workspace.yaml` and imports files through the `@sitekit/` alias (Vite and `tsconfig.json`); its Vitest also runs the tests here.

What the web code expects of a site:

- `@/` is the site's `src/` (Vite, Vitest and `tsconfig.json` paths). `i18n.ts` and `i18next.d.ts` read the site's own text from `@/locales/{zh-Hans,en,ja,ko}.json`; the site's keys add to `src/locales/` here and win where both have one.
- Every site's text has these keys, worded per site: `common.siteTitle`, `messages.firstLogin`, `messages.memberNamesUnavailable`, `messages.publicChartCount`. The type check fails when one is missing.
- Category names are the site's text too, `categories.<id>` for each category its API lists (`categories.variety` at least: choosing none is Variety on both sites); `categories.tsx` falls back to the API's title.
- A component that hands a chart back to the site takes the site's `Chart` as a type parameter (it extends `ChartBase`), as `uploadChart` does.

To change shared code: commit and push `main` here, then commit the new submodule pointer in each site. A site's pointer must be a commit on `main`.
