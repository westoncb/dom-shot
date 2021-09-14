import regeneratorRuntime from "regenerator-runtime" // needed for async/await
import * as THREE from "three"
import {
    Box3,
    BoxGeometry,
    Mesh,
    MeshBasicMaterial,
    Quaternion,
    Vector3,
} from "three"
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js"
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js"
import { SAOPass } from "three/examples/jsm/postprocessing/SAOPass.js"
// import { GUI } from "three/examples/jsm/libs/dat.gui.module"
import Util from "./util"
import Game from "./game"
import LilSM from "./lilsm"
import css from "./main.css"
import ParticleSystem from "./particleSystem"
var OrbitControls = require("three-orbit-controls")(THREE)

window.onload = program

// ambient occlusion enabled
let aoOn = false

//dat-gui enabled
let guiOn = false

// dat-gui instance
const gui = null

const enableOrbitControls = false
const shouldRenderForwardView = false

let camera, camera2
let scene
let renderer
let composer
let lastFrameTime
let directionalLight
let spotLight
const mouse = new THREE.Vector2()
const raycaster = new THREE.Raycaster()

let activeGame

async function program() {
    console.log("testblah")

    if (window.location.href.includes("ycombinator")) {
        launch3dMode()
    } else {
        const runningAsExtension = chrome.runtime
        console.log("test", runningAsExtension)
        if (runningAsExtension) {
            addLaunchButton()
        } else {
            showTestPage()
        }
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

function showTestPage() {
    initThreeScene()
    const editorRoot = document.createElement("div")
    editorRoot.id = "editor-root"
    document.body.appendChild(editorRoot)
    editorRoot.innerHTML = `
        This is a test!
    `

    animate()
}

async function launch3dMode() {
    initThreeScene()

    toggleLoadingUI(true)
    await Game.loadAssets()
    startGame()
    toggleLoadingUI(false)
    // initDebugPanel()

    document.getElementsByTagName("body")[0].style.overflow = "hidden"

    animate()
}

function startGame() {
    activeGame = new Game(scene, camera, spotLight)
    activeGame.start()
}

let ps
function initThreeScene() {
    scene = new THREE.Scene()
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        100,
        8000
    )

    if (shouldRenderForwardView) {
        camera2 = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            2000
        )
        camera2.up = new Vector3(0, 0, 1)
        scene.add(camera2)
    }

    camera.position.set(0, 0, 800)
    camera.lookAt(0, 0, 0)
    scene.add(camera)
    scene.fog = new THREE.Fog(0x333333, 300, 2000)

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
    renderer.setClearColor("#333333")

    document.body.appendChild(renderer.domElement)

    directionalLight = new THREE.DirectionalLight(0xffffff, 0.75)
    directionalLight.position.set(300, -300, 800)
    directionalLight.target.position.set(0, 0, 0)
    directionalLight.target.updateMatrixWorld()
    directionalLight.castShadow = true
    directionalLight.shadow.mapSize.width = 2048
    directionalLight.shadow.mapSize.height = 2048
    directionalLight.shadow.camera.near = 0.5
    directionalLight.shadow.camera.far = 3000
    const d = 2000
    directionalLight.shadow.camera.left = -d
    directionalLight.shadow.camera.right = d
    directionalLight.shadow.camera.top = d
    directionalLight.shadow.camera.bottom = -d
    directionalLight.shadow.bias = 0.00001
    directionalLight.shadow.intensity = 0.2
    // const helper = new THREE.CameraHelper(directionalLight.shadow.camera)
    // scene.add(helper)

    scene.add(directionalLight)
    const ambientLight = new THREE.HemisphereLight(0xffffbb, 0x080840, 0.5)
    scene.add(ambientLight)

    spotLight = new THREE.SpotLight(0x6688cc, 0.325)
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

    ps = new ParticleSystem()
    scene.add(ps.getObj3d())

    // const m = new Mesh(
    //     new BoxGeometry(50, 50, 50),
    //     new MeshBasicMaterial({ color: "red" })
    // )
    // scene.add(m)
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

function animate(time) {
    const delta = lastFrameTime !== undefined ? time - lastFrameTime : 16

    // implement proper game loop setup; currently the real delta is too variable, causes jitter
    const deltaSeconds = 16 / 1000
    lastFrameTime = time

    if (Game.loaded) {
        LilSM.globalUpdate(deltaSeconds)
        activeGame.update(deltaSeconds, enableOrbitControls)
    }

    ps.update(deltaSeconds)

    render()
    requestAnimationFrame(animate)
}

function render() {
    // raycaster.setFromCamera(mouse, camera)
    // const intersects = raycaster.intersectObjects(scene.children)
    // highlightHoveredObjects(intersects)

    renderer.setViewport(0, 0, window.innerWidth, window.innerHeight)

    if (aoOn && composer) {
        composer.render()
    } else if (renderer) {
        renderer.render(scene, camera)
    }

    if (shouldRenderForwardView) {
        renderForwardView()
    }
}

function renderForwardView() {
    const insetWidth = 400
    const insetHeight = 180

    renderer.clearDepth() // important!

    renderer.setScissorTest(true)

    renderer.setScissor(20, 20, insetWidth, insetHeight)

    renderer.setViewport(20, 20, insetWidth, insetHeight)

    const shipPos = activeGame.ship.obj3d.position.clone()
    camera2.position.copy(
        shipPos
            .clone()
            .add(
                new Vector3(0, 0, 40).add(
                    activeGame.ship.direction.clone().multiplyScalar(30)
                )
            )
    )
    const advec = activeGame.ship.direction.clone().multiplyScalar(200)
    camera2.lookAt(shipPos.clone().add(advec))
    camera2.updateMatrixWorld()

    renderer.render(scene, camera2)

    renderer.setScissorTest(false)
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
    saoPass.params.saoIntensity = 0.025
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
