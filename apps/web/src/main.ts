import { dir } from '@kakeya/geometry'

// Placeholder wiring check until the scene engine lands.
const east = dir(0)
if (east.x !== 1) throw new Error('geometry package failed to load')
