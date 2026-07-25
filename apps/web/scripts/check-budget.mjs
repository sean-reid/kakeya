import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

// Budgets, enforced: initial JS and total first load, gzipped.
const JS_BUDGET = 60 * 1024
const TOTAL_BUDGET = 250 * 1024

const dist = new URL('../dist', import.meta.url).pathname
const sizes = []
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path)
    else if (/\.(js|css|html)$/.test(name)) {
      sizes.push({ path: path.slice(dist.length + 1), gz: gzipSync(readFileSync(path)).length })
    }
  }
}
walk(dist)

const js = sizes.filter((s) => s.path.endsWith('.js')).reduce((a, s) => a + s.gz, 0)
const total = sizes.reduce((a, s) => a + s.gz, 0)
for (const s of sizes) console.log(`${(s.gz / 1024).toFixed(2).padStart(8)} KB gz  ${s.path}`)
console.log(
  `js ${(js / 1024).toFixed(2)} KB of ${JS_BUDGET / 1024}, total ${(total / 1024).toFixed(2)} KB of ${TOTAL_BUDGET / 1024}`,
)
if (js > JS_BUDGET || total > TOTAL_BUDGET) {
  console.error('budget exceeded')
  process.exit(1)
}
