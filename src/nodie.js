import * as THREE from "three"
import Entity from "./entity"
import Assets from "./assets"
import { Vector3 } from "three"
import { nanoid } from "nanoid"
import LilSM from "./lilsm"
import Game from "./game"
import { easeOutQuint, easeOutBack } from "./util"

class Nodie {
    static create(node, subDSector) {
        const nodie = new Entity("nodie")
        nodie.id = nanoid()
        nodie.domNode = node

        nodie.customInit = () => {
            if (!nodie.initialized) {
                const cubeData = node2AbstractCube(node, subDSector)
                nodie.obj3d = abstractCube2Mesh(cubeData)
                nodie.initialized = true
            }
        }

        nodie.sm = Nodie.buildStateMachine(nodie.id)

        nodie.customUpdate = deltaTime => {
            if (nodie.sm.current().name === "ascend") {
                if (!nodie.groundPos) {
                    nodie.groundPos = nodie.obj3d.position.clone()
                    nodie.ascendPos = nodie.groundPos.clone()
                    nodie.ascendPos.z = Game.instance.domBBox.max.z + 100
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
            }
        }

        return nodie
    }

    static buildStateMachine(id) {
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
                name: "ascend",
                initial: "flyover",
                final: "asteroids",
                duration: 0.5,
            },
        ]
        return new LilSM(states, transitions, "flyover", `nodie_${id}_sm`)
    }

    static subdivide(nodie) {
        const node = nodie.domNode
        const subs = [
            Nodie.create(node, 0),
            Nodie.create(node, 1),
            Nodie.create(node, 2),
            Nodie.create(node, 3),
        ]
        subs.forEach(s => {
            s.customInit()
            s.obj3d.position.add(
                new Vector3(
                    Math.random() * 10 - 5,
                    Math.random() * 10 - 5,
                    Math.random() * 10 - 5
                )
            )
        })
        return subs
    }
}

function node2AbstractCube(node, subDSector = -1) {
    const docHeight = document.body.scrollHeight
    const rect = node.getBoundingClientRect() // does this exactly match the rect node-to-image is using?
    const treeDepth = getDepth(node, 1)
    const ELEMENT_DEPTH = 12

    if (subDSector !== -1) {
        rect.width /= 2
        rect.height /= 2
    }

    switch (subDSector) {
        case 0:
            break
        case 1:
            rect.x += rect.width
            break
        case 2:
            rect.y += rect.height
            break
        case 3:
            rect.x += rect.width
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
        node,
        treeDepth,
    }

    return props
}

function abstractCube2Mesh(cube) {
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
