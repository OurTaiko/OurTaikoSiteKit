# OurTaikoSiteKit

Code shared by the two OurTaiko chart sites, [Fanmade](https://github.com/OurTaiko/Fanmade) and [OurTaikoDatabase](https://github.com/OurTaiko/OurTaikoDatabase). Each site checks this repository out as the git submodule `kit/` and pins a commit; database migrations stay in the sites.

- Go module `ourtaiko.dev/sitekit` (`audio`, `constants`, `cover`, `objectstore`, `video`). A site requires it with `replace ourtaiko.dev/sitekit => ./kit`. Test here with `go test ./...`.
- `web/`: the pnpm workspace package `@ourtaiko/sitekit`, source only. A site lists `../kit/web` in its `pnpm-workspace.yaml` and imports files through the `@sitekit/` alias (Vite and `tsconfig.json`); its Vitest also runs the tests here.

To change shared code: commit and push `main` here, then commit the new submodule pointer in each site. A site's pointer must be a commit on `main`.
