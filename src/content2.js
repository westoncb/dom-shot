import regeneratorRuntime from "regenerator-runtime" // needed for async/await
import domtoimage from "dom-to-image-improved"
import * as THREE from "three"
import { Box3, Vector3 } from "three"
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js"
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js"
import { SAOPass } from "three/examples/jsm/postprocessing/SAOPass.js"
// import { GUI } from "three/examples/jsm/libs/dat.gui.module"
import Util from "./util"
import Game from "./game"
var OrbitControls = require("three-orbit-controls")(THREE)

window.onload = program

// ambient occlusion enabled
let aoOn = false

//dat-gui enabled
let guiOn = false

// dat-gui instance
const gui = null

const enableOrbitControls = false

let docHeight
let docWidth
let texture = null

let camera
let scene
let renderer
let composer
let lastFrameTime
let directionalLight
let spotLight
const mouse = new THREE.Vector2()
const raycaster = new THREE.Raycaster()

let activeGame

const ourNodes = [
    "ds123-webglcanvas",
    "ds123-loading-container",
    "wcb_debug_panel",
]

async function program() {
    docHeight = document.body.scrollHeight
    docWidth = document.body.scrollWidth

    if (window.location.href.includes("ycombinator")) {
        launch3dMode()
    } else {
        addLaunchButton()
    }
}

function addLaunchButton() {
    const btn = document.createElement("button")
    btn.id = "ds123-launcher"
    btn.style.backgroundImage = `url(${chrome.runtime.getURL(
        "assets/play.svg"
    )})`
    btn.onclick = () => {
        btn.style.display = "none"
        launch3dMode()
    }
    document.body.appendChild(btn)
}

async function launch3dMode() {
    initThreeScene()

    toggleLoadingUI(true)
    await build3dDOM()
    await Game.loadAssets()
    startGame()
    toggleLoadingUI(false)
    // initDebugPanel()

    document.getElementsByTagName("body")[0].style.overflow = "hidden"

    animate()
}

function startGame() {
    activeGame = new Game(scene, camera, spotLight)
}

function initThreeScene() {
    scene = new THREE.Scene()
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        100,
        8000
    )
    camera.position.set(0, 0, 800)
    camera.lookAt(0, 0, 0)
    scene.add(camera)

    if (enableOrbitControls) {
        new OrbitControls(camera)
    }

    renderer = new THREE.WebGLRenderer({
        antialias: false,
        stencil: false,
        physicallyCorrectLights: false,
        toneMapping: THREE.ReinhardToneMapping,
    })
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap

    const winWidth = window.innerWidth
    const winHeight = window.innerHeight
    renderer.setSize(winWidth, winHeight)
    renderer.domElement.id = "ds123-webglcanvas"
    renderer.domElement.style.zIndex = "99999"
    renderer.setClearColor("#666666")

    document.body.appendChild(renderer.domElement)

    directionalLight = new THREE.DirectionalLight(0xffffff, 0.75)
    directionalLight.position.set(300, -300, 2000)
    directionalLight.target.position.set(0, 0, 0)
    directionalLight.target.updateMatrixWorld()
    directionalLight.castShadow = true
    directionalLight.shadow.mapSize.width = 2048
    directionalLight.shadow.mapSize.height = 2048
    directionalLight.shadow.camera.near = 0.5
    directionalLight.shadow.camera.far = 2000
    const d = 2000
    directionalLight.shadow.camera.left = -d
    directionalLight.shadow.camera.right = d
    directionalLight.shadow.camera.top = d
    directionalLight.shadow.camera.bottom = -d
    directionalLight.shadow.bias = 0.00001
    // const helper = new THREE.CameraHelper(directionalLight.shadow.camera)
    // scene.add(helper)

    scene.add(directionalLight)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2)
    scene.add(ambientLight)

    spotLight = new THREE.SpotLight(0x6688cc, 0.425)
    spotLight.position.set(-100, 125, -10)
    spotLight.castShadow = false
    spotLight.angle = Math.PI / 10
    spotLight.penumbra = 0.5
    // spotLight.shadow.mapSize.width = 512
    // spotLight.shadow.mapSize.height = 512
    // spotLight.shadow.camera.near = 0.5
    // spotLight.shadow.camera.far = 1000
    // spotLight.shadow.focus = 1
    // spotLight.shadow.camera.fov = 30
    camera.add(spotLight)
    // const helper = new THREE.CameraHelper(spotLight.shadow.camera)
    // scene.add(helper)

    if (aoOn) {
        composer = new EffectComposer(renderer)
        setUpPostProcessing()
    }

    // if (guiOn) {
    //     gui = new GUI()
    // }

    const webglCanvas = renderer.domElement
    webglCanvas.style.position = "absolute"
    webglCanvas.style.left = "0"
    webglCanvas.style.right = "0"
    webglCanvas.style.bottom = "0"
    webglCanvas.style.top = "0"
}

async function build3dDOM() {
    const nodes = []
    const bodyNode = document.querySelectorAll("body")[0]
    collectNodes(bodyNode, nodes)

    try {
        texture = await getDOMTex(bodyNode)

        const cubeData = nodes
            .filter(acceptableNode)
            .map(node => node2AbstractCube(node))
        cubeData.sort((a, b) => {
            return a.treeDepth - b.treeDepth
        })
        cubeData.sort((a, b) => {
            return Number(a.node.style.zIndex) - Number(b.node.style.zIndex)
        })

        // Grab node images out of order
        const results = await Promise.allSettled(
            cubeData.map(abstractCube2Mesh)
        )
        results.forEach(result => {
            if (result.status === "fulfilled") {
                const { mesh, sideMesh } = result.value
                scene.add(mesh)
                scene.add(sideMesh)
            } else {
                console.log(result.reason)
            }
        })

        // Grab node images in order
        // ;(async () => {
        //     for (const cube of cubeData) {
        //         try {
        //             console.log("before")
        //             const { mesh, sideMesh } = await abstractCube2Mesh(cube)
        //             console.log(mesh)
        //             scene.add(mesh)
        //         } catch (err) {
        //             console.error(err)
        //         }
        //         // scene.add(sideMesh)
        //     }
        // })()
    } catch (err) {
        console.error(err)
    }
}

function toggleLoadingUI(on = true) {
    const id = "ds123-loading-container"
    let container = document.getElementById(id)

    if (!container) {
        container = document.createElement("div")
        container.id = id

        document.body.appendChild(container)

        container.innerHTML = `
        <img style="width: 6rem; height: 6rem;" src="${chrome.runtime.getURL(
            "assets/spinner.svg"
        )}"/>
        Loading...
    `
    }

    if (on) {
        container.style.visibility = "visible"
        container.style.opacity = "1"
    } else {
        container.style.opacity = "0"
        setTimeout(() => {
            container.style.visibility = "hidden"
        }, 250)
    }
}

function getDepth(node, depth) {
    if (node.parentNode) {
        return getDepth(node.parentNode, depth + 1)
    } else {
        return depth
    }
}

function collectNodes(node, array) {
    array.push(node)

    for (const child of node.childNodes) {
        collectNodes(child, array)
    }
}

function animate(time) {
    const delta = lastFrameTime !== undefined ? time - lastFrameTime : 15

    // implement proper game loop setup; currently the real delta is too variable, causes jitter
    const deltaSeconds = 15 / 1000
    lastFrameTime = time

    if (Game.loaded) {
        activeGame.update(deltaSeconds, enableOrbitControls)
    }

    render()
    requestAnimationFrame(animate)
}

function render() {
    if (camera) {
        camera.updateMatrixWorld()
    }

    // raycaster.setFromCamera(mouse, camera)
    // const intersects = raycaster.intersectObjects(scene.children)
    // highlightHoveredObjects(intersects)

    if (aoOn && composer) {
        composer.render()
    } else if (renderer) {
        renderer.render(scene, camera)
    }
}

function initDebugPanel() {
    // set up debug panel
    const deb = document.createElement("div")
    deb.style.position = "fixed"
    deb.style.left = "0"
    deb.style.top = "0"
    deb.style.width = "400px"
    deb.style.backgroundColor = "rgba(0, 0, 0, 0.75)"
    deb.style.zIndex = "2"
    deb.style.wordBreak = "break-all"
    deb.id = "wcb_debug_panel"
    deb.style.padding = "1rem"
    deb.innerText = "test123"
    document.body.appendChild(deb)
}

const hoveredObjectsMap = {}

function highlightHoveredObjects(intersects) {
    if (intersects.length > 0) {
        const object = intersects[0].object
        deb.innerText =
            JSON.stringify(object.userData.domNode.getBoundingClientRect()) +
            "\n\n" +
            JSON.stringify(object.position) +
            "\n\n" +
            JSON.stringify({
                id: object.userData.domNode.id,
                className: object.userData.domNode.className,
            })

        // Highlight hovered objects green
        if (hoveredObjectsMap[object.id] === undefined) {
            hoveredObjectsMap[object.id] = object.material.color.clone()
            object.material.color.set(0x00ff00)
        }
    }

    // Clear highlights on previously hovered objects
    if (hoveredObjectsMap) {
        for (const [key, value] of Object.entries(hoveredObjectsMap)) {
            if (hoveredObjectsMap[key]) {
                const obj = scene.getObjectById(Number(key))
                if (obj && !(intersects[0] && intersects[0].object === obj)) {
                    obj.material.color = value
                    hoveredObjectsMap[key] = undefined
                } else if (!obj) {
                    console.log("no obj for key: ", key)
                }
            }
        }
    } else {
        console.log("not there")
    }
}

function setUpPostProcessing() {
    const renderPass = new RenderPass(scene, camera)
    composer.addPass(renderPass)
    const saoPass = new SAOPass(scene, camera, false, true)
    composer.addPass(saoPass)
    saoPass.params.saoScale = 289
    saoPass.params.saoIntensity = 0.015
    saoPass.params.saoKernelRadius = 16
    saoPass.params.saoBlurRadius = 2.2
    saoPass.params.saoStdDev = 2

    if (guiOn) {
        gui.add(saoPass.params, "output", {
            Beauty: SAOPass.OUTPUT.Beauty,
            "Beauty+SAO": SAOPass.OUTPUT.Default,
            SAO: SAOPass.OUTPUT.SAO,
            Depth: SAOPass.OUTPUT.Depth,
            Normal: SAOPass.OUTPUT.Normal,
        }).onChange(function (value) {
            saoPass.params.output = parseInt(value)
        })
        gui.add(saoPass.params, "saoBias", -1, 1)
        gui.add(saoPass.params, "saoIntensity", 0.01, 0.1)
        gui.add(saoPass.params, "saoScale", 1, 300)
        gui.add(saoPass.params, "saoKernelRadius", 10, 50)
        gui.add(saoPass.params, "saoMinResolution", 0, 50)
        gui.add(saoPass.params, "saoBlur")
        gui.add(saoPass.params, "saoBlurRadius", 1, 20)
        gui.add(saoPass.params, "saoBlurStdDev", 0.5, 15)
        gui.add(saoPass.params, "saoBlurDepthCutoff", 0.0, 0.1)
        document.getElementsByClassName("dg")[0].style.zIndex = "999999"
    }
}

function onMouseMove(event) {
    // calculate mouse position in normalized device coordinates
    // (-1 to +1) for both components

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
}

// window.addEventListener("mousemove", onMouseMove, false)

function node2AbstractCube(node) {
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

async function abstractCube2Mesh(cube) {
    const node = cube.node

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

    const w = cube.width / 2
    const h = cube.height / 2
    const d = cube.depth / 2

    // create a simple square shape. We duplicate the top left and bottom right
    // vertices because each vertex needs to appear once per triangle.
    const vertices = new Float32Array([
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

    mesh.userData.domNode = node
    sideMesh.userData.domNode = node
    mesh.frustumCulled = false
    sideMesh.frustumCulled = false

    return { mesh, sideMesh }
}

async function getDOMTex(node) {
    if (node.scrollWidth === 0 || node.scrollHeight === 0) {
        return null
    }

    const result = await domtoimage
        .toPixelData(node, {
            imagePlaceholder: "data:text/plain;base64,SGVsbG8sIFdvcmxkIQ==",
            filter: curNode => {
                return !ourNodes.includes(curNode.id)
            },
        })
        .then(function (pixels) {
            const tex = new THREE.DataTexture(
                pixels,
                node.scrollWidth,
                node.scrollHeight,
                THREE.RGBAFormat
            )
            tex.minFilter = THREE.LinearFilter
            tex.magFilter = THREE.LinearFilter

            tex.flipY = true

            return tex
        })

    return result
}

function acceptableNode(node) {
    const valid =
        node.nodeType === Node.ELEMENT_NODE &&
        !ourNodes.includes(node.id) &&
        !["link, script, meta"].includes(node.tagName.toLowerCase())

    return valid
}

function encode(input) {
    var keyStr =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/="
    var output = ""
    var chr1, chr2, chr3, enc1, enc2, enc3, enc4
    var i = 0

    while (i < input.length) {
        chr1 = input[i++]
        chr2 = i < input.length ? input[i++] : Number.NaN // Not sure if the index
        chr3 = i < input.length ? input[i++] : Number.NaN // checks are needed here

        enc1 = chr1 >> 2
        enc2 = ((chr1 & 3) << 4) | (chr2 >> 4)
        enc3 = ((chr2 & 15) << 2) | (chr3 >> 6)
        enc4 = chr3 & 63

        if (isNaN(chr2)) {
            enc3 = enc4 = 64
        } else if (isNaN(chr3)) {
            enc4 = 64
        }
        output +=
            keyStr.charAt(enc1) +
            keyStr.charAt(enc2) +
            keyStr.charAt(enc3) +
            keyStr.charAt(enc4)
    }
    return output
}
