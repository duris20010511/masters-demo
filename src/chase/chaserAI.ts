export type ChaserState = 'patrol' | 'investigate' | 'chase' | 'search' | 'return'

export interface ChaserConfig {
  waypoints: { x: number; z: number }[]
  hearRadius: number
  sightRadius: number
  sightAngleDeg: number
  speedPatrol: number
  speedChase: number
  searchMs: number
  catchRadius: number
}

export interface ChaserInput {
  dtMs: number
  playerPos: { x: number; z: number }
  playerIsRunning: boolean
  occluded: boolean
}

export interface ChaserOutput {
  pos: { x: number; z: number }
  state: ChaserState
  facing: number
  caught: boolean
}

type Point = { x: number; z: number }

const ARRIVAL_DISTANCE = 0.001

export class ChaserAI {
  private readonly config: ChaserConfig
  private pos: Point
  private state: ChaserState = 'patrol'
  private facing = 0
  private waypointIndex = 1
  private returnWaypointIndex = 0
  private investigateTarget: Point | null = null
  private lastSeen: Point | null = null
  private lostSightMs = 0
  private searchElapsedMs = 0
  private caught = false

  constructor(config: ChaserConfig) {
    if (config.waypoints.length < 2) throw new Error('ChaserAI requires at least two waypoints')
    this.config = config
    this.pos = { ...config.waypoints[0] }
    this.facing = this.angleTo(config.waypoints[1])
  }

  reset(): void {
    this.pos = { ...this.config.waypoints[0] }
    this.state = 'patrol'
    this.waypointIndex = 1
    this.returnWaypointIndex = 0
    this.investigateTarget = null
    this.lastSeen = null
    this.lostSightMs = 0
    this.searchElapsedMs = 0
    this.caught = false
    this.facing = this.angleTo(this.config.waypoints[1])
  }

  update(input: ChaserInput): ChaserOutput {
    const dtSeconds = Math.max(0, input.dtMs) / 1000
    const visible = this.canSee(input)
    this.catchPlayer(input.playerPos)

    if (this.state === 'patrol') {
      if (visible) this.beginChase(input.playerPos)
      else if (input.playerIsRunning && this.distanceTo(input.playerPos) <= this.config.hearRadius) {
        this.state = 'investigate'
        this.investigateTarget = { ...input.playerPos }
      }
    } else if (this.state === 'investigate' && visible) {
      this.beginChase(input.playerPos)
    } else if (this.state === 'search' && visible) {
      this.beginChase(input.playerPos)
    }

    if (this.state === 'patrol') {
      if (this.moveToward(this.config.waypoints[this.waypointIndex], this.config.speedPatrol, dtSeconds)) {
        this.waypointIndex = (this.waypointIndex + 1) % this.config.waypoints.length
      }
    } else if (this.state === 'investigate') {
      if (this.investigateTarget && this.moveToward(this.investigateTarget, this.config.speedPatrol, dtSeconds)) {
        this.beginReturn()
      }
    } else if (this.state === 'chase') {
      if (visible) {
        this.lastSeen = { ...input.playerPos }
        this.lostSightMs = 0
      } else {
        this.lostSightMs += Math.max(0, input.dtMs)
      }

      if (this.lastSeen && this.moveToward(this.lastSeen, this.config.speedChase, dtSeconds) && this.lostSightMs >= 1000) {
        this.state = 'search'
        this.searchElapsedMs = 0
      }
    } else if (this.state === 'search') {
      this.searchElapsedMs += Math.max(0, input.dtMs)
      if (this.searchElapsedMs >= this.config.searchMs) {
        this.beginReturn()
      } else if (this.lastSeen) {
        const angle = (this.searchElapsedMs / 1000) * Math.PI * 2.0
        const target = {
          x: this.lastSeen.x + Math.cos(angle) * 1.5,
          z: this.lastSeen.z + Math.sin(angle) * 1.5,
        }
        this.moveToward(target, this.config.speedPatrol, dtSeconds)
      }
    } else if (this.state === 'return') {
      if (this.moveToward(this.config.waypoints[this.returnWaypointIndex], this.config.speedPatrol, dtSeconds)) {
        this.waypointIndex = (this.returnWaypointIndex + 1) % this.config.waypoints.length
        this.state = 'patrol'
      }
    }

    this.catchPlayer(input.playerPos)
    return { pos: { ...this.pos }, state: this.state, facing: this.facing, caught: this.caught }
  }

  private beginChase(playerPos: Point): void {
    this.state = 'chase'
    this.lastSeen = { ...playerPos }
    this.lostSightMs = 0
  }

  private beginReturn(): void {
    this.returnWaypointIndex = this.closestWaypointIndex()
    this.state = 'return'
    this.investigateTarget = null
  }

  private canSee(input: ChaserInput): boolean {
    if (input.occluded || this.distanceTo(input.playerPos) > this.config.sightRadius) return false
    const targetAngle = this.angleTo(input.playerPos)
    const difference = Math.atan2(Math.sin(targetAngle - this.facing), Math.cos(targetAngle - this.facing))
    return Math.abs(difference) <= (this.config.sightAngleDeg * Math.PI) / 360
  }

  private moveToward(target: Point, speed: number, dtSeconds: number): boolean {
    const dx = target.x - this.pos.x
    const dz = target.z - this.pos.z
    const distance = Math.hypot(dx, dz)
    if (distance <= ARRIVAL_DISTANCE) {
      this.pos = { ...target }
      return true
    }

    this.facing = Math.atan2(dx, dz)
    const step = Math.max(0, speed) * dtSeconds
    if (step >= distance) {
      this.pos = { ...target }
      return true
    }
    this.pos = { x: this.pos.x + (dx / distance) * step, z: this.pos.z + (dz / distance) * step }
    return false
  }

  private distanceTo(target: Point): number {
    return Math.hypot(target.x - this.pos.x, target.z - this.pos.z)
  }

  private angleTo(target: Point): number {
    return Math.atan2(target.x - this.pos.x, target.z - this.pos.z)
  }

  private closestWaypointIndex(): number {
    let closestIndex = 0
    let closestDistance = Infinity
    for (let index = 0; index < this.config.waypoints.length; index++) {
      const distance = this.distanceTo(this.config.waypoints[index])
      if (distance < closestDistance) {
        closestDistance = distance
        closestIndex = index
      }
    }
    return closestIndex
  }

  private catchPlayer(playerPos: Point): void {
    if (this.distanceTo(playerPos) <= this.config.catchRadius) this.caught = true
  }
}
