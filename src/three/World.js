import * as THREE from 'three'
import { BOUNDARY, CREASE_Z, FIELD, KEEPER, STRIKER_Z, STUMPS_Z, boundaryDist, pointFrom } from '../game/field.js'
import { Cricketer } from './Cricketer.js'
import { GUARDS, RELEASE, sampleAt } from '../game/physics.js'
import { drawScreen } from './textures.js'
import { buildStadium, makeStumps, resetStumps } from './stadium.js'
import { QUALITY } from './quality.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'

const RAD = Math.PI / 180
const BALL_R = 0.045

const CAMERAS = {
  // landscape: low broadcast camera behind the bowler (umpire centre, batter + keeper at the far end)
  broadcast: { pos: [0, 3.6, -18.5], look: [0, 0.15, 7], fov: 22 },
  // portrait phones: high camera looking down the pitch
  broadcastP: { pos: [0, 8.6, -17.5], look: [0, 0, 3.2], fov: 42 },
  batter: { pos: [-0.9, 2.3, 15.8], look: [0.2, 1.0, -8], fov: 34 },
  batterP: { pos: [-0.6, 2.8, 16.5], look: [0.1, 0.8, -6], fov: 52 },
  // replay / DRS angles
  side: { pos: [-26, 2.6, 7.2], look: [0, 0.9, 6.6], fov: 26 },
  sideP: { pos: [-26, 2.6, 7.2], look: [0, 0.9, 6.6], fov: 48 },
  behindBat: { pos: [0.4, 1.7, 16.5], look: [0, 0.9, -6], fov: 30 },
  behindBatP: { pos: [0.4, 1.9, 17.5], look: [0, 0.9, -6], fov: 52 },
  stump: { pos: [0.22, 0.32, STUMPS_Z + 0.75], look: [0, 0.5, 0], fov: 46 },
  stumpP: { pos: [0.22, 0.32, STUMPS_Z + 0.75], look: [0, 0.5, 0], fov: 70 },
  hawk: { pos: [0.6, 3.2, -4], look: [0, 0.4, STUMPS_Z], fov: 30 },
  hawkP: { pos: [0.6, 5.2, -6], look: [0, 0.2, STUMPS_Z - 1], fov: 46 },
  // dynamic cameras: positions are filled in each frame from the players (see dynamicCam)
  pro: { pos: [0, 1.6, STRIKER_Z], look: [0, 1.0, -STUMPS_Z], fov: 58 },
  proP: { pos: [0, 1.6, STRIKER_Z], look: [0, 1.0, -STUMPS_Z], fov: 78 },
  bowlerEnd: { pos: [-1.4, 2.4, -21], look: [0, 0.6, STUMPS_Z], fov: 30 },
  bowlerEndP: { pos: [-1.4, 2.8, -21], look: [0, 0.4, STUMPS_Z - 1], fov: 50 },
}

/** Player-facing camera cycle (V / camera button). */
export const VIEWS = [
  { key: 'broadcast', label: 'Broadcast' },
  { key: 'batter', label: 'Behind batter' },
  { key: 'pro', label: 'Pro cam (helmet)' },
  { key: 'bowlerEnd', label: 'Bowler end' },
]
export const nextView = (v) => VIEWS[(VIEWS.findIndex((x) => x.key === v) + 1) % VIEWS.length].key
export const viewLabel = (v) => VIEWS.find((x) => x.key === v)?.label ?? v

const lerp = (a, b, t) => a + (b - a) * t
const ease = (t) => t * t * (3 - 2 * t)

export class World {
  constructor(container, { night, venue, teamColors, whites = false, quality = 'medium' }) {
    this.container = container
    this.Q = QUALITY[quality] ?? QUALITY.medium
    this.whites = whites
    this.night = night
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.Q.pixelRatio))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = this.Q.shadowType === 'soft' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = night ? 1.05 : 1.0
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    container.appendChild(this.renderer.domElement)

    this.scene = new THREE.Scene()
    this.scene.fog = new THREE.Fog(night ? '#141a35' : '#cfe3f5', 160, 420)
    this.camera = new THREE.PerspectiveCamera(17, 16 / 9, 0.1, 1200)
    this.view = 'broadcast'
    this.camLook = new THREE.Vector3(...CAMERAS.broadcast.look)
    this.camPos = new THREE.Vector3(...CAMERAS.broadcast.pos)
    this.followBall = false

    this.handles = buildStadium(this.scene, { night, teamColors, venue, whites, quality: this.Q })
    if (this.Q.bloom) {
      // HD: soft glow on floodlights, LED boards and the sky
      this.composer = new EffectComposer(this.renderer)
      this.composer.addPass(new RenderPass(this.scene, this.camera))
      this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(512, 512), night ? 0.5 : 0.22, 0.55, 0.86))
      this.composer.addPass(new OutputPass())
    }
    this.stumpsFar = makeStumps(-STUMPS_Z)
    this.stumpsNear = makeStumps(STUMPS_Z)
    this.scene.add(this.stumpsFar, this.stumpsNear)

    // ball with seam
    this.ball = new THREE.Group()
    // white ball for limited overs, red ball for Tests
    const leather = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 20, 14), new THREE.MeshStandardMaterial({ color: whites ? '#a3121b' : '#f4f4f0', roughness: 0.35 }))
    leather.castShadow = true
    const seam = new THREE.Mesh(new THREE.TorusGeometry(BALL_R * 1.01, 0.004, 4, 24), new THREE.MeshBasicMaterial({ color: whites ? '#f2ecd8' : '#c0262d' }))
    this.ball.add(leather, seam)
    this.ball.visible = false
    this.scene.add(this.ball)

    this.buildMarkers()

    this.chars = new Map() // key -> Cricketer
    this.active = [] // characters currently in the scene
    this.tasks = []
    this.cheer = 0
    this.clock = new THREE.Clock()
    this.raycaster = new THREE.Raycaster()
    this.onMarkerPick = null

    this.resize = this.resize.bind(this)
    this.loop = this.loop.bind(this)
    this.onPointer = this.onPointer.bind(this)
    this.ro = new ResizeObserver(this.resize)
    this.ro.observe(container)
    this.renderer.domElement.addEventListener('pointerdown', this.onPointer)
    this.resize()
    this.raf = requestAnimationFrame(this.loop)
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    this.ro.disconnect()
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointer)
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  resize() {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.portrait = w / h < 1
    this.camera.updateProjectionMatrix()
    this.composer?.setSize(w, h)
  }

  // ---------------- markers (bowling target, pitch spot, shot direction) ----------------

  buildMarkers() {
    const blue = new THREE.MeshBasicMaterial({ color: '#2f5bff', transparent: true, opacity: 0.9, depthWrite: false })
    this.marker = new THREE.Group()
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.2), blue)
    bar.rotation.x = -Math.PI / 2
    const tri = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0, 0.17), new THREE.Vector2(0.22, -0.1), new THREE.Vector2(-0.05, -0.1)]))
    for (const s of [-1, 1]) {
      const t = new THREE.Mesh(tri, blue)
      t.rotation.x = -Math.PI / 2
      t.position.set(s * 0.52, 0, 0.02)
      t.scale.x = s
      this.marker.add(t)
    }
    const cap = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.12), blue)
    cap.rotation.x = -Math.PI / 2
    cap.position.z = -0.22
    this.marker.add(bar, cap)
    this.marker.position.y = 0.012
    this.marker.visible = false
    this.scene.add(this.marker)

    this.spot = new THREE.Mesh(new THREE.RingGeometry(0.14, 0.2, 32), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, depthWrite: false }))
    this.spot.rotation.x = -Math.PI / 2
    this.spot.position.y = 0.013
    this.spot.visible = false
    this.scene.add(this.spot)

    // shot-direction arrow on the ground in front of the striker
    const arrowMat = new THREE.MeshBasicMaterial({ color: '#ffd34d', transparent: true, opacity: 0.55, depthWrite: false })
    this.arrow = new THREE.Group()
    const shaft = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 4.2), arrowMat)
    shaft.rotation.x = -Math.PI / 2
    shaft.position.z = -2.4
    const head = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0, 0.5), new THREE.Vector2(0.32, -0.1), new THREE.Vector2(-0.32, -0.1)])), arrowMat)
    head.rotation.x = -Math.PI / 2
    head.position.z = -4.6
    this.arrow.add(shaft, head)
    this.arrow.position.set(0, 0.015, STRIKER_Z - 0.6)
    this.arrow.visible = false
    this.scene.add(this.arrow)

    // guard mark scratched on the popping crease + a faint line back to the stump being covered
    const guardMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, depthWrite: false })
    this.guardMark = new THREE.Group()
    const scratch = new THREE.Mesh(new THREE.PlaneGeometry(0.035, 0.42), guardMat)
    scratch.rotation.x = -Math.PI / 2
    scratch.position.z = CREASE_Z - 0.21
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.012, STUMPS_Z - CREASE_Z), new THREE.MeshBasicMaterial({ color: '#ffd34d', transparent: true, opacity: 0.45, depthWrite: false }))
    line.rotation.x = -Math.PI / 2
    line.position.z = (CREASE_Z + STUMPS_Z) / 2
    this.guardMark.add(scratch, line)
    this.guardMark.position.y = 0.014
    this.guardMark.visible = false
    this.scene.add(this.guardMark)
    this.guard = 'middle'
    this.guardShown = 0 // current animated offset of the striker
  }

  /** Striker's guard (leg | middle | off); the batter shuffles across smoothly in step(). */
  setGuard(name, showMark = false) {
    this.guard = GUARDS[name] ? name : 'middle'
    this.guardMark.position.x = GUARDS[this.guard].x
    this.guardMark.visible = showMark
  }

  setMarker(visible, lineX = 0.2, lengthDist = 5.6) {
    this.marker.visible = visible
    this.marker.position.x = lineX
    this.marker.position.z = STUMPS_Z - lengthDist
  }

  setArrow(visible, dir = 0) {
    this.arrow.visible = visible
    this.arrow.rotation.y = -dir * RAD
  }

  onPointer(e) {
    if (!this.marker.visible || !this.onMarkerPick) return
    const r = this.renderer.domElement.getBoundingClientRect()
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    this.raycaster.setFromCamera(ndc, this.camera)
    const hit = new THREE.Vector3()
    if (this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit)) {
      this.onMarkerPick(Math.max(-1.2, Math.min(1.4, hit.x)), Math.max(0.5, Math.min(12, STUMPS_Z - hit.z)))
    }
  }

  // ---------------- people ----------------

  char(player, team, role) {
    const key = `${player?.id ?? role}-${role}-${team.id}`
    if (!this.chars.has(key)) this.chars.set(key, new Cricketer({ player, team, role, whites: this.whites }))
    return this.chars.get(key)
  }

  /** Put the current players on the field. */
  setLineup({ battingTeam, bowlingTeam, striker, nonStriker, bowler, keeper, fielders }) {
    for (const c of this.active) this.scene.remove(c.root)
    this.active = []
    const add = (c) => {
      this.scene.add(c.root)
      this.active.push(c)
      c.move = null
      return c
    }
    this.striker = striker ? add(this.char(striker, battingTeam, 'batter')) : null
    this.nonStriker = nonStriker ? add(this.char(nonStriker, battingTeam, 'batter')) : null
    this.bowler = bowler ? add(this.char(bowler, bowlingTeam, 'bowler')) : null
    this.keeper = add(this.char(keeper, bowlingTeam, 'keeper'))
    this.fielders = fielders.map((p) => add(this.char(p, bowlingTeam, 'fielder')))
    this.umpire = add(this.char({ id: 'ump1', look: { skin: '#c98d63', hair: '#2b1d14', hairStyle: 2, beard: true } }, bowlingTeam, 'umpire'))
    this.legUmpire = add(this.char({ id: 'ump2', look: { skin: '#e3b08a', hair: '#5a3b22', hairStyle: 0, beard: false } }, bowlingTeam, 'umpire'))
    this.resetPositions()
  }

  resetPositions() {
    this.tasks = []
    this.rec = null
    this.clearTracking()
    this.followBall = false
    this.ball.visible = false
    this.spot.visible = false
    resetStumps(this.stumpsFar)
    resetStumps(this.stumpsNear)
    const S = (c, x, z, clip, faceX, faceZ) => {
      if (!c) return
      c.move = null
      c.setPosition(x, z)
      c.face(faceX, faceZ)
      c.play(clip, {}, { blend: 0 })
    }
    if (this.striker) {
      this.guardShown = GUARDS[this.guard].x
      S(this.striker, -0.42 + this.guardShown, STRIKER_Z - 0.1, 'stance', 10, STRIKER_Z - 0.1)
      this.striker.root.rotation.y = Math.PI / 2
    }
    S(this.nonStriker, 1.7, -CREASE_Z - 0.4, 'idle', 1.7, 0)
    S(this.bowler, -1.7, -17.5, 'idle', -0.55, 0)
    S(this.keeper, KEEPER.x, KEEPER.z, 'keeper', 0, 0)
    this.fielders.forEach((f, i) => S(f, FIELD[i].x, FIELD[i].z, 'ready', 0, STRIKER_Z - 2))
    S(this.umpire, 0, -STUMPS_Z - 1.6, 'umpire', 0, 0)
    S(this.legUmpire, -25, STRIKER_Z, 'umpire', 0, STRIKER_Z)
  }

  setView(v) {
    this.view = v
  }

  setBigScreen(title, sub) {
    drawScreen(this.handles.screen.canvas, title, sub)
    this.handles.screen.tex.needsUpdate = true
  }

  // ---------------- task helpers ----------------

  after(sec, fn) {
    let t = 0
    this.tasks.push((dt) => ((t += dt) >= sec ? (fn(), true) : false))
  }

  animate(duration, fn, done) {
    let t = 0
    this.tasks.push((dt) => {
      t += dt
      const u = Math.min(1, t / duration)
      fn(u)
      if (u >= 1) {
        done?.()
        return true
      }
      return false
    })
  }

  wait(sec) {
    return new Promise((r) => this.after(sec, r))
  }

  // ---------------- delivery ----------------

  /**
   * Run-up + delivery. Resolves `released` when the ball leaves the hand.
   * plan: { lengthDist, lineX, turn, length, onStumps }, travel: seconds from release to the stumps.
   */
  deliver(plan, travel, { showSpot = false } = {}) {
    const b = this.bowler
    this.startRecording()
    this.bounced = false
    const start = { x: -1.7, z: -17.5 }
    const crease = { x: -0.55, z: -9.6 }
    b.setPosition(start.x, start.z)
    b.face(crease.x, crease.z)
    return new Promise((resolve) => {
      b.moveTo(crease.x, crease.z, 8, () => {
        b.face(crease.x, 10)
        b.play('bowl', {}, { blend: 0.08 })
        // follow-through after the delivery stride
        this.after(0.95, () => b.moveTo(-1.9, -5.5, 4, null, 'idle'))
        this.after(0.42, () => {
          // real physics path (metres/seconds); played back slower or faster to suit the difficulty
          const path = plan.path
          const hand = b.handWorld('R')
          this.path = path
          this.handOffset = new THREE.Vector3(hand.x - RELEASE.x, hand.y - RELEASE.y, hand.z - RELEASE.z)
          this.timeScale = path.tStumps / travel
          this.traj = {
            b: new THREE.Vector3(path.bounce.x, BALL_R, path.bounce.z),
            e: new THREE.Vector3(path.atStumps.x, path.atStumps.y, STUMPS_Z),
            pB: path.bounce.t / path.tStumps,
          }
          this.travel = travel
          this.ballT = 0
          this.inFlight = true
          this.ball.visible = true
          this.emit('release')
          if (showSpot) {
            this.spot.position.set(this.traj.b.x, 0.013, this.traj.b.z)
            this.spot.visible = true
          }
          if (this.striker) this.striker.play('backlift', {}, { blend: 0.25 })
          resolve()
        })
      })
      b.play('run', { freq: 1.9 }, { blend: 0.1 })
    })
  }

  /** Ball progress: 0 at release, 1 at the batter's stumps. */
  progress() {
    return this.inFlight ? this.ballT / this.path.tStumps : 0
  }

  /** Physics time of the ball in flight (seconds since release, in game time). */
  ballTime() {
    return this.inFlight ? this.ballT : Infinity
  }

  ballAtProgress(p) {
    const t = p * this.path.tStumps
    const s = sampleAt(this.path.samples, t)
    const fade = Math.max(0, 1 - t / 0.1) // blend from the bowler's actual hand onto the physics path
    return new THREE.Vector3(s.x + this.handOffset.x * fade, s.y + this.handOffset.y * fade, s.z + this.handOffset.z * fade)
  }

  // ---------------- outcome ----------------

  /** Striker plays a shot animation (visual: { shot, dir, foot }). */
  swing(visual) {
    if (!this.striker) return
    this.striker.play('shot', { shot: visual.shot ?? 'leave', dir: visual.dir ?? 0, foot: visual.foot ?? 'front' }, { blend: 0.05 })
  }

  /**
   * Animate what happened after the shot. Resolves when the play is dead.
   * result: { runs, wicket, extra, visual }, contactDelay: seconds until bat meets ball.
   */
  playOutcome(result, contactDelay = 0.08) {
    return new Promise((resolve) => {
      const v = result.visual ?? {}
      const done = (extra = 0.9) => this.after(extra, resolve)
      const catchAt = (who, pos, then) => {
        who.play(who === this.keeper ? 'keeperCatch' : 'catch')
        this.ballOwner = who
        this.emit('catch')
        then?.(pos)
      }

      if (result.extra) {
        this.inFlight = false
        this.ball.visible = false
        this.umpire.play(result.extra === 'wide' ? 'umpWide' : 'umpFour')
        return done(1.4)
      }

      // Ball not hit: leave / miss / bowled / lbw / keeper
      if (!v.shot || v.miss || v.stumps || v.pad) {
        const stopAt = v.stumps ? 1.0 : v.pad ? 0.94 : 1.18
        this.waitForProgress(stopAt, () => {
          this.inFlight = false
          if (v.stumps) {
            this.breakStumps(this.stumpsNear)
            this.ballDrop(this.ball.position.clone(), new THREE.Vector3(this.ball.position.x * 1.5, BALL_R, STUMPS_Z + 2.5), 0.5)
            if (v.catcher === 'keeper') this.keeper.play('keeperCatch')
            this.wicketReaction('bowled')
          } else if (v.pad) {
            this.ballDrop(this.ball.position.clone(), new THREE.Vector3(this.ball.position.x + 0.6, BALL_R, STRIKER_Z - 1.4), 0.55)
            this.emit('pad')
            this.emit('appeal')
            this.bowler.play('appeal')
            this.keeper.play('appeal')
            this.after(0.8, () => (result.wicket ? this.wicketReaction('lbw') : this.umpire.play('umpire')))
          } else {
            this.keeper.play('keeperCatch')
            this.ball.position.set(KEEPER.x, 0.9, KEEPER.z - 0.35)
            if (result.wicket === 'caughtBehind') this.after(0.3, () => this.wicketReaction('caught'))
            else if (result.appeal) {
              this.emit('appeal')
              this.after(0.2, () => this.keeper.play('appeal'))
            }
          }
          done(result.wicket ? 2.2 : 1.0)
        })
        return
      }

      if (v.flight) return this.playFlight(result, contactDelay, resolve)

      // Bat on ball
      this.after(contactDelay, () => {
        this.inFlight = false
        const from = this.ball.position.clone()
        this.emit('bat', v.edge ? 0.4 : v.shot === 'push' ? 0.6 : 1)
        if (v.edge) {
          // thin edge through to the keeper
          const to = new THREE.Vector3(KEEPER.x + 0.2, 1.0, KEEPER.z - 0.4)
          this.ballArc(from, to, 0.35, 0.3, () => {
            catchAt(this.keeper)
            if (result.wicket) this.wicketReaction('caught')
            else {
              this.emit('appeal')
              this.keeper.play('appeal')
              this.bowler.play('appeal')
            }
            done(2.0)
          })
          this.keeper.play('keeperCatch')
          return
        }

        const target = pointFrom(v.dir, v.dist)
        const to = new THREE.Vector3(target.x, BALL_R, target.z)
        const air = v.air
        const flight = air ? 0.9 + v.dist / 26 : 0.35 + v.dist / 24
        const apex = result.runs === 6 ? 24 : result.wicket === 'caught' ? 10 + v.dist / 6 : air ? 5 + v.dist / 12 : 0.4
        this.followBall = true

        // pick the chasing fielder
        const fi = v.catcher === 'keeper' ? null : v.catcher ?? this.nearestFielderTo(to)
        const chaser = fi == null ? this.bowler : this.fielders[fi]

        if (result.wicket === 'caught') {
          const catchPos = chaser.root.position.clone()
          const tgt = new THREE.Vector3(catchPos.x, 1.6, catchPos.z)
          this.ballArc(from, tgt, flight, apex, () => {
            catchAt(chaser, tgt)
            this.wicketReaction('caught', chaser)
            done(2.2)
          })
          chaser.face(from.x, from.z)
          this.after(flight - 0.5, () => chaser.play('catch'))
          return
        }

        if (result.runs === 6) {
          const land = pointFrom(v.dir, boundaryDist(v.dir) + 16)
          this.ballArc(from, new THREE.Vector3(land.x, 9, land.z), flight + 0.4, apex, () => {
            this.ball.visible = false
          })
          this.after(0.35, () => this.striker?.play('celebrateBat'))
          this.after(flight * 0.8, () => {
            this.emit('six')
            this.umpire.play('umpSix')
            this.cheer = 3
          })
          const near = this.nearestFielderTo(new THREE.Vector3(land.x, 0, land.z))
          const f = this.fielders[near]
          const edge = pointFrom(v.dir, BOUNDARY - 2)
          f.moveTo(edge.x, edge.z, 6, () => f.play('idle'))
          return done(flight + 1.6)
        }

        // along the ground (or a lofted shot that lands in the field)
        const travelTo = result.runs === 4 ? pointFrom(v.dir, boundaryDist(v.dir) + 1.5) : target
        const dest = new THREE.Vector3(travelTo.x, BALL_R, travelTo.z)
        if (air) this.ballArc(from, dest, flight, apex)
        else this.ballRoll(from, dest, flight)

        if (result.runs === 4) {
          const edge = pointFrom(v.dir, BOUNDARY - 3)
          chaser.moveTo(edge.x, edge.z, 7.5, () => chaser.play('pickup'))
          this.after(flight * 0.9, () => {
            this.emit('four')
            this.umpire.play('umpFour')
            this.cheer = 2
          })
          return done(flight + 1.4)
        }

        // fielder collects and throws back; batters run
        const collect = () => {
          chaser.play('pickup')
          this.after(0.35, () => {
            chaser.face(0, CREASE_Z)
            chaser.play('throw')
            this.after(0.25, () => {
              const hand = chaser.handWorld('R')
              const back = new THREE.Vector3(KEEPER.x, 1.1, KEEPER.z - 1.5)
              this.ballArc(hand, back, 0.25 + hand.distanceTo(back) / 32, 2 + hand.distanceTo(back) / 18, () => this.keeper.play('keeperCatch'))
            })
          })
        }
        chaser.moveTo(dest.x - Math.sign(dest.x) * 0.3, dest.z + 0.6, 7.5, () => this.after(Math.max(0, flight - 0.4), collect), 'ready')

        // dead ball once the batters have finished running and the throw is back
        Promise.all([this.runBetweenWickets(result.runs), this.wait(flight + 1.3)]).then(() => done(0.5))
      })
    })
  }

  /** Seconds (real time) until the ball reaches the contact point, given the current ball time. */
  contactDelay() {
    if (!this.path) return 0.06
    return Math.max(0.03, (this.path.tContact - this.ballT) / (this.timeScale || 1))
  }

  /** Character for a fielding role from the physics adjudication. */
  whoIs(by) {
    if (by === 'keeper') return this.keeper
    if (by === 'bowler') return this.bowler
    return this.fielders[by] ?? this.fielders[0]
  }

  /** Follow the physics flight of a struck ball: catches, boundaries, ground fielding and running. */
  playFlight(result, contactDelay, resolve) {
    const v = result.visual
    const fl = v.flight
    const a = v.adj
    const S = fl.samples
    const done = (extra) => this.after(extra, resolve)
    this.after(contactDelay, () => {
      this.inFlight = false
      this.emit('bat', v.edge ? 0.4 : v.shot === 'push' ? 0.6 : 1)
      this.followBall = true
      const end = a.kind === 'caught' ? a.t : a.kind === 'six' ? S[S.length - 1].t : a.kind === 'four' ? Math.min(a.t + 0.7, S[S.length - 1].t) : a.t
      this.ball.visible = true
      // the ball follows the simulated path in real time
      let t = 0
      this.tasks.push((dt) => {
        t = Math.min(end, t + dt)
        const p = sampleAt(S, t)
        this.ball.position.set(p.x, Math.max(p.y, BALL_R), p.z)
        this.ball.rotation.x += 0.4
        return t >= end
      })

      const who = a.by != null ? this.whoIs(a.by) : null
      const runTo = (c, at, arriveT, then) => {
        // leave after a reaction, run to arrive just in time
        this.after(0.3, () => {
          const d = Math.hypot(at.x - c.root.position.x, at.z - c.root.position.z)
          const speed = Math.min(8.5, Math.max(2.5, d / Math.max(0.2, arriveT - 0.3)))
          if (d < 0.3) return then?.()
          c.moveTo(at.x, at.z, speed, then, 'ready')
        })
      }

      if (a.kind === 'caught') {
        runTo(who, a.at, a.t, () => {
          who.face(a.at.x - 0.01, a.at.z - 2)
          who.play(who === this.keeper ? 'keeperCatch' : 'catch')
        })
        this.after(Math.max(0, a.t - 0.45), () => who.play(who === this.keeper ? 'keeperCatch' : 'catch'))
        this.after(a.t, () => {
          this.emit('catch')
          if (result.wicket) this.wicketReaction('caught', who)
        })
        return done(a.t + 2.2)
      }

      if (a.kind === 'six') {
        this.after(0.35, () => this.striker?.play('celebrateBat'))
        this.after(a.t, () => {
          this.emit('six')
          this.umpire.play('umpSix')
          this.cheer = 3
        })
        if (who) runTo(who, { x: a.at.x * 0.96, z: a.at.z * 0.96 }, a.t)
        else {
          const f = this.fielders[this.nearestFielderTo(new THREE.Vector3(a.at.x, 0, a.at.z))]
          runTo(f, { x: a.at.x * 0.96, z: a.at.z * 0.96 }, a.t + 0.5)
        }
        return done(Math.min(end, a.t + 1.8) + 0.6)
      }

      if (a.kind === 'four') {
        const f = who ?? this.fielders[this.nearestFielderTo(new THREE.Vector3(a.at.x, 0, a.at.z))]
        runTo(f, { x: a.at.x * 0.95, z: a.at.z * 0.95 }, a.t + 0.4, () => f.play('pickup'))
        this.after(a.t, () => {
          this.emit('four')
          this.umpire.play('umpFour')
          this.cheer = 2
        })
        if (result.runs === 4 && this.nonStriker) this.runBetweenWickets(1)
        return done(end + 1.2)
      }

      // fielded (or dropped then fielded): collector gathers and throws to the keeper's end
      if (a.kind === 'dropped') {
        const dropper = this.whoIs(a.by)
        dropper.play('catch')
        this.after(0.6, () => dropper.play('dejected'))
      }
      const collector = who ?? this.bowler
      runTo(collector, a.at, a.t, () => collector.play('pickup'))
      this.after(a.t, () => {
        collector.play('pickup')
        this.after(0.3, () => {
          collector.face(0, CREASE_Z)
          collector.play('throw')
          this.after(0.2, () => {
            const hand = collector.handWorld('R')
            const back = new THREE.Vector3(KEEPER.x, 1.1, KEEPER.z - 1.5)
            this.ballArc(hand, back, 0.2 + hand.distanceTo(back) / 30, 1 + hand.distanceTo(back) / 20, () => this.keeper.play('keeperCatch'))
          })
        })
      })
      Promise.all([this.runBetweenWickets(result.runs), this.wait((a.deadT ?? a.t + 1) + 0.2)]).then(() => done(0.5))
    })
  }

  waitForProgress(p, fn) {
    this.tasks.push(() => (this.progress() >= p || !this.inFlight ? (fn(), true) : false))
  }

  nearestFielderTo(pos) {
    let best = 0
    let bd = Infinity
    this.fielders.forEach((f, i) => {
      const d = f.root.position.distanceTo(new THREE.Vector3(pos.x, 0, pos.z))
      if (d < bd) {
        bd = d
        best = i
      }
    })
    return best
  }

  ballArc(from, to, duration, apex, done) {
    this.ball.visible = true
    this.animate(duration, (u) => {
      this.ball.position.set(lerp(from.x, to.x, u), lerp(from.y, to.y, u) + apex * 4 * u * (1 - u), lerp(from.z, to.z, u))
      this.ball.rotation.x += 0.4
    }, done)
  }

  ballRoll(from, to, duration, done) {
    this.ball.visible = true
    this.animate(duration, (u) => {
      const e = 1 - (1 - u) * (1 - u)
      const hop = u < 0.25 ? 0.5 * Math.sin((u / 0.25) * Math.PI) : 0
      this.ball.position.set(lerp(from.x, to.x, e), BALL_R + hop + (1 - e) * Math.max(0, from.y - BALL_R) * (u < 0.1 ? 1 - u * 10 : 0), lerp(from.z, to.z, e))
      this.ball.rotation.x += 0.5 * (1 - u)
    }, done)
  }

  ballDrop(from, to, duration) {
    this.ballArc(from, to, duration, 0.3)
  }

  breakStumps(g) {
    this.emit('stumps')
    const { stumps, bails } = g.userData
    const spin = [-0.9, 0.25, 0.8]
    this.animate(0.5, (u) => {
      const e = ease(u)
      stumps.forEach((s, i) => {
        s.rotation.z = spin[i] * e
        s.rotation.x = -0.6 * e
      })
      bails.forEach((b, i) => {
        b.position.set((i ? 1 : -1) * (0.057 + 0.5 * e), 0.72 + 0.9 * Math.sin(Math.PI * u) - 0.6 * e, 0.4 * e)
        b.rotation.x += 0.4
      })
    })
  }

  wicketReaction(kind, catcher) {
    this.after(kind === 'lbw' ? 0.1 : 0.5, () => this.umpire.play('umpOut'))
    this.emit('wicket', kind)
    // bowler wheels away with arms out, team-mates run in for a huddle
    const b = this.bowler
    const dest = { x: b.root.position.x - 3, z: Math.min(b.root.position.z + 7, 0) }
    b.moveTo(dest.x, dest.z, 5.5, () => b.play('fistPump'), null, 'airplane')
    this.fielders.forEach((f, i) => {
      if (f === catcher) return this.after(0.7, () => f.play('cheer'))
      const d = f.root.position.distanceTo(new THREE.Vector3(dest.x, 0, dest.z))
      if (d > 48) return this.after(Math.random() * 0.4, () => f.play('cheer'))
      const a = (i / 9) * Math.PI * 2
      this.after(0.3 + Math.random() * 0.5, () =>
        f.moveTo(dest.x + Math.cos(a) * 1.5, dest.z + Math.sin(a) * 1.5, 7, () => {
          f.face(dest.x, dest.z)
          f.play('cheer')
        }),
      )
    })
    this.after(0.6, () => this.keeper.moveTo(dest.x + 1.2, dest.z + 1.4, 6.5, () => this.keeper.play('cheer')))
    this.after(0.9, () => this.striker?.play('dejected'))
    this.cheer = 1.5
  }

  /** Batter raises the bat for a fifty / hundred. */
  celebrateMilestone() {
    this.striker?.play('celebrateBat')
    this.cheer = 2.5
  }

  /** End of the match: winners celebrate. */
  celebrateWin(battingWon) {
    this.cheer = 4
    if (battingWon && this.striker && this.nonStriker) {
      this.striker.moveTo(-0.6, 0.6, 6, () => this.striker.play('celebrateBat'))
      this.nonStriker.moveTo(-0.6, -0.6, 6, () => this.nonStriker.play('celebrateBat'))
    } else {
      this.fielders.forEach((f, i) => {
        const a = (i / 9) * Math.PI * 2
        f.moveTo(Math.cos(a) * 2, -2 + Math.sin(a) * 2, 7, () => {
          f.face(0, -2)
          f.play('cheer')
        })
      })
      this.bowler?.play('cheer')
      this.keeper.moveTo(1.4, -1, 6, () => this.keeper.play('cheer'))
    }
  }

  // ---------------- sound / replay hooks ----------------

  emit(type, data) {
    this.mark(type)
    this.onEvent?.(type, data, this.screenPan())
  }

  /** Where the ball is across the screen (-1 left … +1 right), so sounds pan with the camera. */
  screenPan() {
    const p = this.ball.position.clone().project(this.camera)
    return Number.isFinite(p.x) && p.z < 1 ? Math.max(-1, Math.min(1, p.x)) * 0.7 : 0
  }

  startRecording() {
    this.rec = { t: 0, frames: [], marks: {}, chars: [...this.active] }
  }

  mark(name) {
    if (this.rec && this.rec.marks[name] == null) this.rec.marks[name] = this.rec.t
  }

  captureFrame() {
    const r = this.rec
    const a = []
    const bp = this.ball.position
    a.push(bp.x, bp.y, bp.z, this.ball.visible ? 1 : 0)
    for (const c of r.chars) {
      a.push(c.root.position.x, c.root.position.z, c.root.rotation.y, c.body.position.x, c.body.position.y)
      for (const j of Object.values(c.j)) a.push(j.quaternion.x, j.quaternion.y, j.quaternion.z, j.quaternion.w)
      a.push(c.j.bat.position.x, c.j.bat.position.y, c.j.bat.position.z)
    }
    for (const g of [this.stumpsNear, this.stumpsFar]) {
      for (const m of [...g.userData.stumps, ...g.userData.bails]) a.push(m.position.x, m.position.y, m.position.z, m.rotation.x, m.rotation.y, m.rotation.z)
    }
    r.frames.push({ t: r.t, d: Float32Array.from(a) })
    if (r.frames.length > 1500) r.frames.shift()
  }

  applyFrame(d) {
    let k = 0
    this.ball.position.set(d[k++], d[k++], d[k++])
    this.ball.visible = d[k++] > 0.5
    for (const c of this.rec.chars) {
      c.root.position.x = d[k++]
      c.root.position.z = d[k++]
      c.root.rotation.y = d[k++]
      c.body.position.x = d[k++]
      c.body.position.y = d[k++]
      for (const j of Object.values(c.j)) j.quaternion.set(d[k++], d[k++], d[k++], d[k++])
      c.j.bat.position.set(d[k++], d[k++], d[k++])
    }
    for (const g of [this.stumpsNear, this.stumpsFar]) {
      for (const m of [...g.userData.stumps, ...g.userData.bails]) {
        m.position.set(d[k++], d[k++], d[k++])
        m.rotation.set(d[k++], d[k++], d[k++])
      }
    }
  }

  /** TV replay of the last ball from broadcast angles, in slow motion. kind: six | four | bowled | lbw | caught | caughtBehind | stumped */
  replay(kind) {
    const r = this.rec
    if (!r || r.frames.length < 20) return Promise.resolve()
    const m = r.marks
    const end = r.frames[r.frames.length - 1].t
    const hit = m.bat ?? m.pad ?? m.stumps ?? (m.release != null ? m.release + this.travel * 0.93 : end * 0.5)
    const start = Math.max(r.frames[0].t, (m.release ?? hit) - 0.7)
    let segs
    if (kind === 'six' || kind === 'four') segs = [{ cam: 'side', from: start, to: hit + 1.1, speed: 0.5 }, { cam: 'follow', from: hit - 0.15, to: end, speed: 0.9 }]
    else if (kind === 'bowled' || kind === 'stumped') {
      const s = m.stumps ?? hit
      segs = [{ cam: 'behindBat', from: start, to: s + 0.8, speed: 0.45 }, { cam: 'stump', from: s - 0.5, to: s + 0.9, speed: 0.3 }]
    } else if (kind === 'lbw') segs = [{ cam: 'side', from: start, to: hit + 0.9, speed: 0.4 }, { cam: 'behindBat', from: hit - 0.6, to: hit + 0.7, speed: 0.35 }]
    else {
      const c = m.catch ?? end
      segs = [{ cam: 'side', from: start, to: hit + 0.9, speed: 0.5 }, { cam: 'follow', from: hit - 0.1, to: Math.min(end, c + 1.2), speed: 0.85 }]
    }
    this.followBall = false
    return new Promise((resolve) => {
      this.replaying = { segs, i: 0, t: segs[0].from, resolve }
      this.cutTo(segs[0].cam)
    })
  }

  skipReplay() {
    if (this.replaying) this.finishReplay()
  }

  finishReplay() {
    const R = this.replaying
    this.replaying = null
    this.applyFrame(this.rec.frames[this.rec.frames.length - 1].d)
    R.resolve()
  }

  cutTo(cam) {
    const p = CAMERAS[cam + (this.portrait ? 'P' : '')] ?? CAMERAS[cam]
    if (!p) return
    this.camPos.set(...p.pos)
    this.camLook.set(...p.look)
    this.camera.fov = p.fov
    this.camera.updateProjectionMatrix()
  }

  replayStep(dt) {
    const R = this.replaying
    let seg = R.segs[R.i]
    R.t += dt * seg.speed
    if (R.t >= seg.to) {
      R.i++
      if (R.i >= R.segs.length) return this.finishReplay()
      seg = R.segs[R.i]
      R.t = seg.from
      this.cutTo(seg.cam)
    }
    const frames = this.rec.frames
    let lo = 0
    let hi = frames.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (frames[mid].t <= R.t) lo = mid
      else hi = mid - 1
    }
    this.applyFrame(frames[lo].d)
    for (const c of this.rec.chars) c.root.updateMatrixWorld(true)

    if (seg.cam === 'follow') {
      const bp = this.ball.position
      const want = new THREE.Vector3(bp.x * 0.55, Math.max(5, bp.y * 0.7 + 4), bp.z * 0.55 - 20)
      this.camPos.lerp(want, Math.min(1, dt * 2.5))
      this.camLook.lerp(bp, Math.min(1, dt * 6))
      const fov = this.portrait ? 50 : 32
      if (Math.abs(this.camera.fov - fov) > 0.1) {
        this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 3)
        this.camera.updateProjectionMatrix()
      }
    }
    this.camera.position.copy(this.camPos)
    this.camera.lookAt(this.camLook)
  }

  // ---------------- menu / title camera ----------------

  /** Endless menu shot: slow close orbit around the striker, cutting to wide orbits of the ground. */
  heroShow() {
    this.cinematic = { hero: true, t: 0, resolve: () => {} }
    this.striker?.play('celebrateBat')
  }

  heroStep(dt) {
    const c = this.cinematic
    c.t += dt
    const wide = Math.floor(c.t / 9) % 2 === 1
    const s = this.striker?.root.position ?? new THREE.Vector3(0, 0, STRIKER_Z)
    let pos
    let look
    let fov
    if (!wide) {
      const a = 0.6 + c.t * 0.16
      pos = new THREE.Vector3(s.x + Math.cos(a) * 3.4, 1.35 + 0.2 * Math.sin(c.t * 0.4), s.z + Math.sin(a) * 3.4)
      look = new THREE.Vector3(s.x, 1.25, s.z)
      fov = this.portrait ? 55 : 36
    } else {
      const a = c.t * 0.07
      pos = new THREE.Vector3(Math.cos(a) * 78, 30, Math.sin(a) * 78)
      look = new THREE.Vector3(0, 0, 0)
      fov = this.portrait ? 62 : 42
    }
    this.camera.position.copy(pos)
    this.camera.lookAt(look)
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov
      this.camera.updateProjectionMatrix()
    }
    // the hero keeps celebrating
    if (this.striker && this.striker.clip.name !== 'celebrateBat') this.striker.play('celebrateBat')
  }

  /** A still of the current frame (used as the menu background). */
  snapshot() {
    if (this.composer) this.composer.render()
    else this.renderer.render(this.scene, this.camera)
    try {
      return this.renderer.domElement.toDataURL('image/jpeg', 0.7)
    } catch {
      return null
    }
  }

  // ---------------- stadium fly-over (match intro) ----------------

  /** Sweeping aerial shot around the ground that settles into the broadcast camera. */
  flyover(duration = 5.5) {
    return new Promise((resolve) => {
      this.cinematic = { t: 0, dur: duration, resolve }
    })
  }

  skipFlyover() {
    if (!this.cinematic) return
    const c = this.cinematic
    this.cinematic = null
    c.resolve()
  }

  flyStep(dt) {
    const c = this.cinematic
    c.t += dt
    const u = Math.min(1, c.t / c.dur)
    const e = ease(u)
    const preset = CAMERAS['broadcast' + (this.portrait ? 'P' : '')]
    const a = lerp(Math.PI * 0.15, -Math.PI / 2, e)
    const r = lerp(118, 30, e)
    const pos = new THREE.Vector3(Math.cos(a) * r, lerp(62, 9, e), Math.sin(a) * r)
    if (u > 0.82) pos.lerp(new THREE.Vector3(...preset.pos), (u - 0.82) / 0.18)
    const look = new THREE.Vector3(0, lerp(6, 0.6, e), lerp(0, 5, e))
    this.camPos.copy(pos)
    this.camLook.copy(look)
    this.camera.position.copy(pos)
    this.camera.lookAt(look)
    this.camera.fov = lerp(this.portrait ? 62 : 46, preset.fov, Math.max(0, (u - 0.6) / 0.4))
    this.camera.updateProjectionMatrix()
    if (u >= 1) this.skipFlyover()
  }

  // ---------------- DRS ball tracking ----------------

  /** Draw the Hawk-Eye path: tracked (red) to impact, predicted (blue) to the stumps. */
  showTracking(verdict) {
    this.clearTracking()
    if (!this.traj) return
    const g = new THREE.Group()
    const impactP = 0.93
    const pts = []
    for (let p = 0; p <= impactP; p += 0.02) pts.push(this.ballAtProgress(p))
    const impact = this.ballAtProgress(impactP)
    const e = this.traj.e
    const side = e.x >= 0 ? 1 : -1
    const endX = verdict.wickets === 'HITTING' ? Math.max(-0.07, Math.min(0.07, e.x)) : verdict.wickets === 'MISSING' ? side * 0.26 : side * 0.13
    const endY = Math.min(e.y, verdict.wickets === 'MISSING' ? 0.75 : 0.55)
    const red = new THREE.MeshBasicMaterial({ color: '#ff3b3b', transparent: true, opacity: 0.9 })
    const blue = new THREE.MeshBasicMaterial({ color: '#3b9cff', transparent: true, opacity: 0.75 })
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.04, 10), red))
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(impact, new THREE.Vector3(endX, endY, STUMPS_Z)), 8, 0.04, 10), blue))
    const pitchOk = verdict.pitching !== 'OUTSIDE LEG'
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.14, 24), new THREE.MeshBasicMaterial({ color: pitchOk ? '#36d17a' : '#ff3b3b' }))
    disc.rotation.x = -Math.PI / 2
    disc.position.set(this.traj.b.x, 0.015, this.traj.b.z)
    g.add(disc)
    // stumps zone
    const zone = new THREE.Mesh(new THREE.PlaneGeometry(0.23, 0.72), new THREE.MeshBasicMaterial({ color: verdict.wickets === 'HITTING' ? '#ff3b3b' : verdict.wickets === 'MISSING' ? '#36d17a' : '#f0b429', transparent: true, opacity: 0.35, side: THREE.DoubleSide }))
    zone.position.set(0, 0.36, STUMPS_Z)
    g.add(zone)
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), new THREE.MeshBasicMaterial({ color: '#3b9cff' }))
    ball.position.set(endX, endY, STUMPS_Z)
    g.add(ball)
    this.tracking = g
    this.scene.add(g)
    this.ball.visible = false
    this.setView('hawk')
    this.followBall = false
  }

  clearTracking() {
    if (this.tracking) this.scene.remove(this.tracking)
    this.tracking = null
    if (this.view === 'hawk') this.setView('broadcast')
  }

  /** Batters swap ends `runs` times. */
  runBetweenWickets(runs) {
    return new Promise((resolve) => {
      if (!runs || !this.striker || !this.nonStriker) return resolve()
      let a = this.striker
      let b = this.nonStriker
      let n = 0
      const leg = () => {
        if (n >= runs) {
          a.play('idle')
          b.play('idle')
          return resolve()
        }
        n++
        const az = a.root.position.z > 0 ? -CREASE_Z - 0.6 : CREASE_Z + 0.6
        const bz = -az
        let arrived = 0
        const step = () => ++arrived === 2 && this.after(0.15, leg)
        a.moveTo(a === this.striker ? -0.6 : -1.5, az, 10.5, step, null)
        b.moveTo(b === this.striker ? -0.6 : -1.5, bz, 10.5, step, null)
      }
      this.after(0.25, leg)
    })
  }

  // ---------------- frame loop ----------------

  loop() {
    this.raf = requestAnimationFrame(this.loop)
    // Simulate in real time even on slow devices: split long frames into small steps.
    const frame = Math.min(this.clock.getDelta(), 0.25)
    const steps = Math.max(1, Math.ceil(frame / 0.034))
    if (this.replaying) this.replayStep(frame)
    else for (let i = 0; i < steps; i++) this.step(frame / steps)
    if (this.cinematic) this.cinematic.hero ? this.heroStep(frame) : this.flyStep(frame)
    if (this.composer) this.composer.render()
    else this.renderer.render(this.scene, this.camera)
  }

  step(dt) {
    if (this.inFlight) {
      this.ballT += dt * this.timeScale
      this.ball.position.copy(this.ballAtProgress(this.ballT / this.path.tStumps))
      this.ball.rotation.x += 0.6
      if (this.ballT > this.path.samples[this.path.samples.length - 1].t) this.inFlight = false
      if (this.spot.visible && this.progress() > this.traj.pB) this.spot.visible = false
      if (!this.bounced && this.progress() > this.traj.pB) {
        this.bounced = true
        this.emit('bounce')
      }
    } else if (!this.followBall && this.bowler && !this.ball.visible) {
      // ball in the bowler's hand
    }

    // tasks may schedule new tasks while running, so swap the list out first
    const running = this.tasks
    this.tasks = []
    const keep = running.filter((t) => !t(dt))
    this.tasks = keep.concat(this.tasks)
    // guard shuffle: lerp the striker toward the chosen guard while they're in their stance
    const st = this.striker
    if (st && !st.move && (st.clip.name === 'stance' || st.clip.name === 'backlift')) {
      const want = GUARDS[this.guard].x
      if (Math.abs(want - this.guardShown) > 1e-4) {
        const next = lerp(this.guardShown, want, Math.min(1, dt * 10))
        st.root.position.x += next - this.guardShown
        this.guardShown = next
      }
    }
    for (const c of this.active) c.update(dt)

    // crowd excitement + scrolling LED boards
    this.handles.boardsTex.offset.x = (this.handles.boardsTex.offset.x + dt * 0.012) % 1
    if (this.cheer > 0) {
      this.cheer -= dt
      this.handles.crowdTex.offset.y = Math.abs(Math.sin(this.cheer * 22)) * 0.012
    }

    // camera: broadcast framing, panning/zooming to follow the ball in play
    const preset = this.dynamicCam(CAMERAS[this.view + (this.portrait ? 'P' : '')] ?? CAMERAS[this.view])
    const lookTarget = new THREE.Vector3(...preset.look)
    let fov = preset.fov
    if (this.followBall && this.ball.visible) {
      const bp = this.ball.position
      lookTarget.set(bp.x * 0.85, Math.min(bp.y, 8) * 0.5 + 0.5, bp.z * 0.85)
      fov = preset.fov + Math.min(Math.hypot(bp.x, bp.z - STRIKER_Z) / 60, 1) * 26
    }
    this.camLook.lerp(lookTarget, Math.min(1, dt * (this.followBall ? 3.2 : 4)))
    // P_cam ← lerp(P_cam, P_target, k·dt); tracking cams follow faster so the head / run-up never drifts out of frame
    this.camPos.lerp(new THREE.Vector3(...preset.pos), Math.min(1, dt * (preset.track ?? 4)))
    this.camera.position.copy(this.camPos)
    this.camera.lookAt(this.camLook)
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 3)
      this.camera.updateProjectionMatrix()
    }

    if (this.rec) {
      this.rec.t += dt
      this.captureFrame()
    }
  }

  /**
   * Cameras anchored to a player's origin. pro: just in front of the striker's helmet grille,
   * looking down the pitch. bowlerEnd: over the bowler's shoulder through the run-up and delivery.
   */
  dynamicCam(preset) {
    if (this.view === 'pro' && this.striker) {
      const eye = this.striker.j.head.localToWorld(new THREE.Vector3(0, 0.03, 0))
      eye.z -= 0.22 // clear of the grille, toward the bowler
      eye.y = Math.max(eye.y, 0.9)
      return { ...preset, pos: [eye.x, eye.y, eye.z], look: [eye.x * 0.3, 1.0, -STUMPS_Z], track: 14 }
    }
    if (this.view === 'bowlerEnd' && this.bowler) {
      const b = this.bowler.root.position
      // stay behind the bowler but never further up the pitch than the bowling crease
      const z = Math.min(b.z - 3.4, -CREASE_Z - 3.2)
      return { ...preset, pos: [b.x - 0.5, preset.pos[1], z], track: 6 }
    }
    return preset
  }
}
