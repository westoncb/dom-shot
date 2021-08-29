import * as THREE from "three"
import Entity from "./entity"
import Assets from "./assets"

class Nodie {
    static create(node) {
        const nodie = new Entity("nodie")
        nodie.domNode = node

        nodie.customInit = () => {
            const cubeData = node2AbstractCube(node)
            nodie.obj3d = abstractCube2Mesh(cubeData)
        }

        nodie.customUpdate = deltaTime => {}

        return nodie
    }
}

function node2AbstractCube(node) {
    const docHeight = document.body.scrollHeight
    const rect = node.getBoundingClientRect() // does this exactly match the rect node-to-image is using?
    const treeDepth = getDepth(node, 1)
    const ELEMENT_DEPTH = 12

    const props = {
        width: node.scrollWidth,
        height: node.scrollHeight,
        depth: ELEMENT_DEPTH,
        x: rect.x,
        y: docHeight - rect.y - node.scrollHeight,
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
    mesh.position.x = cube.x + cube.width / 2 - docWidth / 2
    mesh.position.y = cube.y + cube.height / 2 - docHeight / 2
    mesh.position.z = cube.z + cube.depth / 2
    mesh.receiveShadow = true
    mesh.castShadow = true

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
