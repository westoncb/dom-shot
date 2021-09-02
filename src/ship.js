import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader"
import { Box3, Sphere, Vector3 } from "three"
import Entity from "./entity"
import Assets from "./assets"
import Game from "./game"
import { boundingSphereForObj3d } from "./util"

const ACCELERATION_MAGNITUTE = 1200

class Ship {
    static create() {
        const ship = new Entity("ship")
        ship.thrusting = false
        ship.turningLeft = false
        ship.turningRight = false
        ship.reversing = false
        ship.firing = false

        ship.customInit = () => {
            ship.obj3d = Assets.get("shipMesh").clone()

            // position the ship at the highest extent of the 3d DOM's bbox
            ship.groundZ = Game.instance.domBBox.max.z
            ship.obj3d.position.z = ship.groundZ
            ship.boundingSphere = boundingSphereForObj3d(ship.obj3d)
        }

        ship.customUpdate = deltaTime => {
            const state = Game.instance.sm.current()
            if (state.name === "start_asteroids") {
                const targetZ = Game.instance.asteroidsPlaneZ
                ship.obj3d.position.z =
                    ship.groundZ +
                    (targetZ - ship.groundZ) * state.completionRatio

                console.log("t", state.completionRatio)
            }

            if (ship.thrusting || ship.reversing) {
                ship.acceleration.copy(
                    ship.direction
                        .clone()
                        .multiplyScalar(
                            (ship.reversing ? -1 : 1) * ACCELERATION_MAGNITUTE
                        )
                )
            } else {
                ship.acceleration.set(0, 0, 0)
            }

            if (ship.turningLeft || ship.turningRight) {
                ship.angularVelocity.z = 6 * (ship.turningLeft ? 1 : -1)
            } else {
                ship.angularVelocity.z = 0
            }

            ship.direction.copy(
                new Vector3(0, 1, 0).applyAxisAngle(
                    new Vector3(0, 0, 1),
                    ship.angle
                )
            )
        }

        return ship
    }

    static loadAssets() {
        const assetsPath = chrome.runtime.getURL("assets/")
        const loader = new GLTFLoader().setPath(assetsPath)

        const shipLoadedHandler = gltf => {
            const shipMesh = gltf.scene

            shipMesh.traverse(function (child) {
                if (child.isMesh) {
                    child.geometry.scale(5, 5, 5)
                    child.geometry.rotateX(-Math.PI / 2)
                    child.geometry.rotateZ(-Math.PI)
                    child.castShadow = true
                    // child.receiveShadow = true
                }
            })
            const shipBBox = new Box3().setFromObject(shipMesh)
            const center = shipBBox.getCenter(new Vector3())

            shipMesh.traverse(function (child) {
                if (child.isMesh) {
                    child.geometry.translate(-center.x, 0, -center.y)
                }
            })

            return shipMesh
        }

        return new Promise((resolve, reject) => {
            loader.load("scene.gltf", gltf => {
                const shipMesh = shipLoadedHandler(gltf)
                const assets = { shipMesh }
                resolve(assets)
            })
        })
    }
}

export default Ship
