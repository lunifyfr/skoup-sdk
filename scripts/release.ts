/**
 * `bun run release 0.2.0` — sets every package (and their internal
 * dependencies) to the version, commits, tags `v0.2.0` and pushes: the
 * tag makes the CI publish to npm and open the GitHub release.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { $ } from 'bun'

const version = process.argv[2]

if (!version || !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error('Usage: bun run release <x.y.z>')
  process.exit(1)
}

if ((await $`git status --porcelain`.text()).trim() !== '') {
  console.error('Commit or stash your changes first.')
  process.exit(1)
}

const packages = readdirSync('packages').map((dir) => `packages/${dir}/package.json`)
const names = packages.map((file) => JSON.parse(readFileSync(file, 'utf8')).name as string)

for (const file of packages) {
  const pkg = JSON.parse(readFileSync(file, 'utf8'))
  pkg.version = version
  for (const key of ['dependencies', 'peerDependencies']) {
    for (const name of Object.keys(pkg[key] ?? {})) {
      if (names.includes(name)) pkg[key][name] = `^${version}`
    }
  }
  writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n')
}

await $`bun install`
await $`bun run lint`
await $`bun run typecheck`
await $`bun run test`
await $`git add -A`
// Nothing to commit when the versions were already there (a re-run): the tag alone.
if ((await $`git status --porcelain`.text()).trim() !== '') {
  await $`git commit -m ${`chore: release v${version}`}`
}
await $`git tag -a ${`v${version}`} -m ${`v${version}`}`
await $`git push origin main --follow-tags`

console.log(`v${version} pushed — the CI publishes it to npm.`)
