export interface HyphaeBranch {
  id: string
  d: string
  strokeWidth: number
}

export interface FruitingBody {
  cx: number
  cy: number
  r: number
}

const SEED = 12345
let seedState = SEED

function seededRandom(): number {
  seedState = (seedState * 1103515245 + 12345) & 0x7fffffff
  return seedState / 0x7fffffff
}

function resetSeed(): void {
  seedState = SEED
}

export function generateHyphae(
  originX: number,
  originY: number,
  seedPoints: Array<{ x: number; y: number }>,
  maxStrokeWidth: number,
  depth: number = 6
): HyphaeBranch[] {
  resetSeed()
  const branches: HyphaeBranch[] = []
  let branchIndex = 0

  const branch = (
    x: number,
    y: number,
    targetX: number,
    targetY: number,
    currentDepth: number,
    parentWidth: number
  ): void => {
    if (currentDepth <= 0) return

    const baseAngle = Math.atan2(targetY - y, targetX - x)
    const jitter = (Math.PI / 180) * 25
    const angle = baseAngle + (seededRandom() - 0.5) * 2 * jitter

    const segmentLength = (60 + seededRandom() * 40) * (currentDepth / depth)
    const newX = x + Math.cos(angle) * segmentLength
    const newY = y + Math.sin(angle) * segmentLength

    const widthDecay = 0.65
    const newWidth = Math.max(0.3, parentWidth * widthDecay)

    const id = `hyph-${branchIndex++}`

    if (currentDepth < depth * 0.7) {
      const cp1x = x + (newX - x) * 0.3 + (seededRandom() - 0.5) * 20
      const cp1y = y + (newY - y) * 0.3 + (seededRandom() - 0.5) * 20
      const cp2x = x + (newX - x) * 0.7 + (seededRandom() - 0.5) * 20
      const cp2y = y + (newY - y) * 0.7 + (seededRandom() - 0.5) * 20
      branches.push({
        id,
        d: `M${x.toFixed(1)},${y.toFixed(1)} C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${newX.toFixed(1)},${newY.toFixed(1)}`,
        strokeWidth: newWidth,
      })
    } else {
      branches.push({
        id,
        d: `M${x.toFixed(1)},${y.toFixed(1)} L${newX.toFixed(1)},${newY.toFixed(1)}`,
        strokeWidth: newWidth,
      })
    }

    const numBranches = currentDepth > depth * 0.5 ? 2 : 3
    for (let i = 0; i < numBranches; i++) {
      const branchTarget =
        i === 0
          ? { x: targetX, y: targetY }
          : {
              x: targetX + (seededRandom() - 0.5) * 150,
              y: targetY + (seededRandom() - 0.5) * 150,
            }
      branch(newX, newY, branchTarget.x, branchTarget.y, currentDepth - 1, newWidth)
    }
  }

  for (const seedPoint of seedPoints) {
    const numMainBranches = 2 + Math.floor(seededRandom() * 2)
    for (let i = 0; i < numMainBranches; i++) {
      branch(originX, originY, seedPoint.x, seedPoint.y, depth, maxStrokeWidth)
    }
  }

  return branches
}

export function generateFruitingBodies(
  seedPoints: Array<{ x: number; y: number }>,
  baseRadius: number = 4
): FruitingBody[] {
  resetSeed()
  const bodies: FruitingBody[] = []

  for (const sp of seedPoints) {
    const numBodies = 1 + Math.floor(seededRandom() * 3)
    for (let i = 0; i < numBodies; i++) {
      const offsetX = (seededRandom() - 0.5) * 30
      const offsetY = (seededRandom() - 0.5) * 30
      const r = baseRadius * (0.6 + seededRandom() * 0.8)
      bodies.push({
        cx: sp.x + offsetX,
        cy: sp.y + offsetY,
        r,
      })
    }
  }

  return bodies
}

export function generateCorruptionPaths(
  originX: number,
  originY: number,
  paths: Array<{ d: string; role: string }>,
  corruptionWidth: number
): Array<{ d: string; strokeWidth: number; opacity: number }> {
  if (corruptionWidth <= 0) return []
  resetSeed()
  const corruptions: Array<{ d: string; strokeWidth: number; opacity: number }> = []

  const pathCount = Math.min(paths.length, 5)
  for (let i = 0; i < pathCount; i++) {
    if (seededRandom() > 0.4) {
      corruptions.push({
        d: paths[i].d,
        strokeWidth: corruptionWidth,
        opacity: 0.3 + seededRandom() * 0.3,
      })
    }
  }

  return corruptions
}
