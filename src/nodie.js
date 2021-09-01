import * as THREE from "three"
import Entity from "./entity"
import Assets from "./assets"
import { Vector3, Box3 } from "three"
import { nanoid } from "nanoid"
import LilSM from "./lilsm"
import Game from "./game"
import { easeOutBack } from "./util"
import isNil from "lodash.isnil"

const MAX_EXTENT = 300

class Nodie {
    static create(node, subDSector, rectBounds) {
        const nodie = new Entity("nodie")
        nodie.id = nanoid()
        nodie.domNode = node
        nodie.frictionCoeffecient = 1

        nodie.rectBounds = rectBounds ?? node.getBoundingClientRect()

        nodie.customInit = () => {
            if (!nodie.initialized) {
                const cubeData = node2AbstractCube(nodie, subDSector)
                nodie.obj3d = abstractCube2Mesh(cubeData, !isNil(subDSector))
                nodie.initialized = true
            }
        }

        nodie.sm = Nodie.buildStateMachine(nodie)

        nodie.customUpdate = deltaTime => {
            if (nodie.sm.current().name === "ascend") {
                if (!nodie.groundPos) {
                    nodie.groundPos = nodie.obj3d.position.clone()
                    nodie.ascendPos = nodie.groundPos.clone()
                    nodie.ascendPos.z =
                        Game.instance.domBBox.max.z +
                        102 +
                        (Math.random() * 2 - 1)
                }

                nodie.obj3d.position.copy(
                    nodie.groundPos
                        .clone()
                        .addScaledVector(
                            nodie.ascendPos.clone().sub(nodie.groundPos),
                            easeOutBack(
                                Math.pow(
                                    nodie.sm.current().completionRatio,
                                    1 / 2
                                )
                            )
                        )
                )
            } else if (nodie.sm.current().name === "asteroids") {
            }
        }

        return nodie
    }

    static buildStateMachine(nodie) {
        const states = [
            {
                name: "flyover",
            },
            {
                name: "asteroids",
                onEnter: () => {
                    nodie.velocity = new Vector3(
                        Math.random(),
                        Math.random(),
                        0
                    ).multiplyScalar(Math.random() * 200 - 100)
                },
            },
        ]
        const transitions = [
            {
                name: "ascend",
                initial: "flyover",
                final: "asteroids",
                duration: 0.5,
            },
        ]
        return new LilSM(states, transitions, "flyover", `nodie_${nodie.id}_sm`)
    }

    static subdivide(nodie) {
        const node = nodie.domNode
        const rect = nodie.rectBounds ?? node.getBoundingClientRect()

        const out = []
        if (rect.width > MAX_EXTENT) {
            out.push(Nodie.create(node, "h0", rect))
            out.push(Nodie.create(node, "h1", rect))
        } else if (rect.height > MAX_EXTENT) {
            out.push(Nodie.create(node, "v0", rect))
            out.push(Nodie.create(node, "v1", rect))
        } else {
            return [nodie]
        }

        out.forEach(s => {
            s.customInit()
        })
        return out.reduce((accum, n) => accum.concat(Nodie.subdivide(n)), [])
    }

    static getBBoxPoints(nodie) {
        const obj3d = nodie.obj3d
        const box = new Box3(
            new Vector3(
                -1 + obj3d.position.x,
                -1 + obj3d.position.y,
                -1 + obj3d.position.z
            ),
            new Vector3(
                1 + obj3d.position.x,
                1 + obj3d.position.y,
                1 + obj3d.position.z
            )
        )
        box.expandByObject(obj3d)
        const bSize = new Vector3()
        box.getSize(bSize)
        const bCenter = new Vector3()
        box.getCenter(bCenter)
        return [
            bCenter,
            box.min,
            box.max,
            box.min.clone().add(new Vector3(bSize.x, 0, 0)),
            box.min.clone().add(new Vector3(0, bSize.y, 0)),
            box.min.clone().add(new Vector3(0, 0, bSize.z)),
            box.max.clone().sub(new Vector3(bSize.x, 0, 0)),
            box.max.clone().sub(new Vector3(0, bSize.y, 0)),
            box.max.clone().sub(new Vector3(0, 0, bSize.z)),
        ]
    }
}

function node2AbstractCube(nodie, subDSector = "") {
    const docHeight = document.body.scrollHeight
    const rect = new DOMRect(
        nodie.rectBounds.x,
        nodie.rectBounds.y,
        nodie.rectBounds.width,
        nodie.rectBounds.height
    ) // does this exactly match the rect node-to-image is using?
    nodie.rectBounds = rect
    const treeDepth = getDepth(nodie.domNode, 1)
    const ELEMENT_DEPTH = 12

    if (subDSector.startsWith("h")) {
        rect.width /= 2
    } else if (subDSector.startsWith("v")) {
        rect.height /= 2
    }

    switch (subDSector) {
        case "h0":
            break
        case "h1":
            rect.x += rect.width
            break
        case "v0":
            break
        case "v1":
            rect.y += rect.height
            break
    }

    const props = {
        width: rect.width,
        height: rect.height,
        depth: ELEMENT_DEPTH,
        x: rect.x,
        y: docHeight - rect.y - rect.height,
        z: treeDepth * ELEMENT_DEPTH,
        yInverse: rect.y,
        node: nodie.domNode,
        treeDepth,
    }

    return props
}

function abstractCube2Mesh(cube, subd) {
    const docHeight = document.body.scrollHeight
    const docWidth = document.body.scrollWidth

    const geometry = new THREE.PlaneBufferGeometry(cube.width, cube.height)
    const material = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        metalness: 0.15,
        roughness: 0.75,
        clearcoat: 0.5,
        clearcoatRoughness: 0.4,
        side: THREE.FrontSide,
    })
    // the issues with elements disappearing at certain camera angles do seem related
    // to depth testing, but setting depthTest: false is insufficient. May be necessary
    // to manually sort objects, or at least ensure fully transparent objects are not
    // getting added to the scene (they almost certainly currently are)
    //
    // The issue may also be relation to precision of depth buffer instead. craigslist.com
    // shows some clear/interesting artifacts that may be useful for debugging this

    const texture = Assets.get("domTexture")
    if (texture) {
        material.map = texture
        material.needsUpdate = true
    }

    const mesh = new THREE.Mesh(geometry, material)
    mesh.userData.objectType = "nodeTop"
    mesh.receiveShadow = true
    mesh.castShadow = true

    const position = new Vector3()
    position.x = cube.x + cube.width / 2 - docWidth / 2
    position.y = cube.y + cube.height / 2 - docHeight / 2
    position.z = cube.z + cube.depth / 2

    if (!subd) {
        // position.x -=
        // position.y -= docHeight / 2
    }

    const nCube = {
        x: cube.x / docWidth,
        y: cube.y / docHeight,
        width: cube.width / docWidth,
        height: cube.height / docHeight,
    }
    const ul = [nCube.x, nCube.y + nCube.height]
    const ur = [nCube.x + nCube.width, nCube.y + nCube.height]
    const ll = [nCube.x, nCube.y]
    const lr = [nCube.x + nCube.width, nCube.y]
    const texCoords = new Float32Array([...ul, ...ur, ...ll, ...lr])

    geometry.setAttribute("uv", new THREE.BufferAttribute(texCoords, 2))

    const sideOutline = [
        [-cube.width / 2, -cube.height / 2],
        [cube.width / 2, -cube.height / 2],
        [cube.width / 2, cube.height / 2],
        [-cube.width / 2, cube.height / 2],
        [-cube.width / 2, -cube.height / 2],
    ].map(p => new THREE.Vector2(p.x, p.y))
    const sideGeometry = new THREE.BufferGeometry()

    const vertices = getVertices(
        cube.width / 2,
        cube.height / 2,
        cube.depth / 2
    )

    // itemSize = 3 because there are 3 values (components) per vertex
    sideGeometry.setAttribute(
        "position",
        new THREE.BufferAttribute(vertices, 3)
    )

    sideGeometry.computeVertexNormals()
    const sideMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xddeeff,
        metalness: 0.15,
        roughness: 0.75,
        clearcoat: 0.5,
        clearcoatRoughness: 0.4,
        side: THREE.DoubleSide,
    })
    // const altGeo = new BoxBufferGeometry(w * 2, h * 2, d * 2)
    // altGeo.scale(1, 1, 0.9)
    const sideMesh = new THREE.Mesh(sideGeometry, sideMaterial)
    sideMesh.userData.objectType = "nodeSides"
    sideMesh.position.copy(mesh.position)
    sideMesh.position.z -= cube.depth * 0.5
    sideMesh.receiveShadow = true
    sideMesh.castShadow = true

    mesh.frustumCulled = false
    sideMesh.frustumCulled = false

    const group = new THREE.Group()
    group.position.copy(position)
    group.userData.objectType = "nodieGroup"
    group.add(mesh)
    group.add(sideMesh)

    return group
}

function getDepth(node, depth) {
    if (node.parentNode) {
        return getDepth(node.parentNode, depth + 1)
    } else {
        return depth
    }
}

function getVertices(w, h, d) {
    // create a simple square shape. We duplicate the top left and bottom right
    // vertices because each vertex needs to appear once per triangle.
    return new Float32Array([
        -w, // left side start
        -h,
        d,
        -w,
        h,
        d,
        -w,
        -h,
        -d,
        -w,
        -h,
        -d,
        -w,
        h,
        -d,
        -w,
        h,
        d,
        w, // right side start
        -h,
        d,
        w,
        h,
        d,
        w,
        -h,
        -d,
        w,
        -h,
        -d,
        w,
        h,
        -d,
        w,
        h,
        d,
        -w, // bottom side start
        -h,
        d,
        w,
        -h,
        d,
        -w,
        -h,
        -d,
        -w,
        -h,
        -d,
        w,
        -h,
        d,
        w,
        -h,
        -d,
        -w, // top side start
        h,
        d,
        w,
        h,
        d,
        -w,
        h,
        -d,
        -w,
        h,
        -d,
        w,
        h,
        d,
        w,
        h,
        -d,
    ])
}

export default Nodie
