import Assets from "./assets"
import Ship from "./ship"
import DOM3D from "./dom3d"
import Util from "./util"
import { Box3, Vector3 } from "three"
import LilSM from "./lilsm"
import Cylinder from "./cylinder"
import Nodie from "./nodie"

const CAM_ROTATION_FROM_VERTICAL = Math.PI / 4.8

class Game {
    scene
    entities = []
    cameraPosDest = new Vector3()
    cameraTargetDest = new Vector3()
    cameraTarget = new Vector3()

    constructor(scene, camera, spotLight) {
        this.scene = scene
        this.camera = camera
        this.spotLight = spotLight

        this.buildStateMachine()
    }

    buildStateMachine() {
        const states = [
            {
                name: "flyover",
            },
            {
                name: "asteroids",
            },
        ]
        const transitions = [
            {
                name: "start_asteroids",
                initial: "flyover",
                final: "asteroids",
                duration: 1,
            },
        ]
        this.sm = new LilSM(states, transitions, "flyover", "game_sm")
    }

    start() {
        this.ship = Ship.create()
        this.setUpEvents()

        const nodies = DOM3D.constructNodies()
        for (const nodie of nodies) {
            this.addEntity(nodie)
        }

        this.domBBox = new Box3()
        Util.findNodesWithType(this.scene, "nodieGroup").forEach(mesh =>
            this.domBBox.expandByObject(mesh)
        )

        Game.instance = this

        this.addEntity(this.ship)
    }

    static async loadAssets() {
        const shipAssets = await Ship.loadAssets()
        Assets.merge(shipAssets)

        const domAssets = await DOM3D.loadAssets()
        Assets.merge(domAssets)

        Game.loaded = true
    }

    setUpEvents() {
        const keyToAttr = {
            w: "thrusting",
            s: "reversing",
            a: "turningLeft",
            d: "turningRight",
        }

        window.onkeydown = e => {
            for (const key of Object.keys(keyToAttr)) {
                if (e.key === key) {
                    this.ship[keyToAttr[key]] = true
                }
            }

            if (e.key === "k") {
                this.breakTiles()
            }
        }
        window.onkeyup = e => {
            for (const key of Object.keys(keyToAttr)) {
                if (e.key === key) {
                    this.ship[keyToAttr[key]] = false
                }
            }
        }
    }

    breakTiles() {
        const cylinder = new Cylinder(
            100,
            200,
            new Vector3(0, 0, Game.instance.domBBox.max.z)
        )

        const nodies = this.getEntitiesWithType("nodie")
        const intersectedNodies = nodies.filter(n => {
            return Nodie.getBBoxPoints(n).reduce(
                (accum, point) => accum || cylinder.containsPoint(point),
                false
            )
        })
        const subdividedNodies = intersectedNodies
            .reduce((accum, n) => accum.concat(Nodie.subdivide(n)), [])
            .filter(n => {
                return Nodie.getBBoxPoints(n).reduce(
                    (accum, point) => accum || cylinder.containsPoint(point),
                    false
                )
            })

        console.log(
            "orig, subd",
            intersectedNodies.length,
            subdividedNodies.length
        )

        intersectedNodies.forEach(n => this.removeEntity(n))
        subdividedNodies.forEach(n => {
            n.obj3d.position.add(
                new Vector3(
                    Math.random() * 40 - 20,
                    Math.random() * 40 - 20,
                    Math.random() * 40 - 20
                )
            )
            this.addEntity(n)
            n.sm.transition("ascend")
        })
    }

    getEntitiesWithType(type) {
        return this.entities.filter(e => e.type === type)
    }

    addEntity(entity) {
        entity.init()
        this.entities.push(entity)
        this.scene.add(entity.obj3d)
    }

    removeEntity(entity) {
        this.entities.splice(this.entities.indexOf(entity), 1)
        this.scene.remove(entity.obj3d)
        entity.dispose()
    }

    update(deltaTime, orbitControlsOn) {
        for (const e of this.entities) {
            // check for collisions

            e.update(deltaTime)
        }

        if (!orbitControlsOn) {
            const shipMesh = this.ship.obj3d
            this.cameraPosDest.copy(cameraPosDestFromShipPos(shipMesh.position))
            this.camera.position.add(
                this.cameraPosDest
                    .clone()
                    .sub(this.camera.position)
                    .multiplyScalar(0.05)
            )

            this.cameraTargetDest.copy(shipMesh.position)
            this.cameraTarget.add(
                this.cameraTargetDest
                    .clone()
                    .sub(this.cameraTarget)
                    .multiplyScalar(0.05)
            )
            this.camera.lookAt(this.cameraTarget)
            this.spotLight.target = shipMesh
        }
    }
}

function cameraPosDestFromShipPos(shipPos) {
    const pos = new Vector3(0, 0, 650)
    pos.applyAxisAngle(new Vector3(1, 0, 0), CAM_ROTATION_FROM_VERTICAL)
    return shipPos.clone().add(pos)
}

export default Game
