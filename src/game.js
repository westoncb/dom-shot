import Assets from "./assets"
import Ship from "./ship"
import Util from "./util"
import { Box3, Vector3 } from "three"

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
        this.ship = Ship.construct()
        this.setUpEvents()

        this.domBBox = new Box3()
        Util.findNodesWithType(this.scene, "nodeTop").forEach(mesh =>
            this.domBBox.expandByObject(mesh)
        )

        Game.instance = this

        this.addEntity(this.ship)
    }

    static async loadAssets() {
        const shipAssets = await Ship.loadAssets()
        Assets.merge(shipAssets)

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
        }
        window.onkeyup = e => {
            for (const key of Object.keys(keyToAttr)) {
                if (e.key === key) {
                    this.ship[keyToAttr[key]] = false
                }
            }
        }
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
