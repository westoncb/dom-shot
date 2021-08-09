import * as THREE from "three"
var OrbitControls = require("three-orbit-controls")(THREE)
import domtoimage from "dom-to-image-improved"
import regeneratorRuntime from "regenerator-runtime"

window.onload = program

function program() {
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        1,
        10000
    )
    camera.position.set(-100, 0, 800)
    camera.lookAt(0, 0, 0)
    scene.add(camera)
    const controls = new OrbitControls(camera)
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()

    const renderer = new THREE.WebGLRenderer()
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.domElement.id = "xyzthisiscrazy"
    renderer.domElement.style.zIndex = "99999"
    renderer.setClearColor("#cccccc")
    document.body.appendChild(renderer.domElement)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9)
    directionalLight.position.set(150, 150, 1000)
    directionalLight.target.position.set(0, 0, 0)
    directionalLight.target.updateMatrixWorld()
    scene.add(directionalLight)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.1)
    scene.add(ambientLight)

    const ele = renderer.domElement
    ele.style.position = "absolute"
    ele.style.left = "0"
    ele.style.right = "0"
    ele.style.bottom = "0"
    ele.style.top = "0"

    const docHeight = document.body.scrollHeight

    console.log("docHeight", docHeight)

    const nodes = []
    collectNodes(document.querySelectorAll("body")[0], nodes)

    function node2AbstractCube(node) {
        const rect = node.getBoundingClientRect()

        const props = {
            width: node.scrollWidth,
            height: node.scrollHeight,
            depth: 10,
            x: rect.x,
            y: docHeight - rect.y - node.scrollHeight,
            z: getDepth(node, 0) * 10,
            node,
        }

        console.log(rect.y)

        return props
    }

    async function abstractCube2Mesh(cube) {
        const node = cube.node
        const tex = await getDOMTex(node)

        const geometry = new THREE.BoxGeometry(
            cube.width,
            cube.height,
            cube.depth
        )
        const material = new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            metalness: 0.1,
            roughness: 0.85,
            clearcoat: 0.15,
            side: THREE.FrontSide,
            transparent: true,
            opacity: 0.5,
        })

        if (tex) {
            material.map = tex
            material.near
            material.needsUpdate = true
        }

        const mesh = new THREE.Mesh(geometry, material)
        mesh.position.x = cube.x + cube.width / 2
        mesh.position.y = cube.y + cube.height / 2
        mesh.position.z = cube.z + cube.depth / 2

        mesh.userData.domNode = node

        return mesh
    }

    async function getDOMTex(node) {
        if (node.scrollWidth === 0 || node.scrollHeight === 0) {
            return null
        }

        // const entries = node.childNodes.entries()

        const result = await domtoimage
            .toPixelData(node, {
                filter: curNode => {
                    let childIsNode = false
                    for (const n of curNode.childNodes.values()) {
                        if (n === node) {
                            childIsNode = true
                        }
                    }
                    // return (
                    //     curNode === node ||
                    //     childIsNode ||
                    //     curNode.nodeType === Node.TEXT_NODE ||
                    //     curNode.childNodes.length === 0 ||
                    //     curNode.childNodes.length === 1
                    // )
                    return true //node.id !== "xyzthisiscrazy"
                },
            })
            .then(function (pixels) {
                const tex = new THREE.DataTexture(
                    pixels,
                    node.scrollWidth,
                    node.scrollHeight,
                    THREE.RGBAFormat
                )

                tex.flipY = true

                return tex
            })

        return result
    }

    function passingNode(node) {
        const valid = node.nodeType === Node.ELEMENT_NODE

        return valid
    }

    function distToLeaf(node, dist) {
        if (node.childNodes.length === 0) {
            return dist
        } else {
            return distToLeaf(node)
        }
    }

    const meshes = nodes
        .filter(passingNode)
        .map(node => node2AbstractCube(node))
        .map(async cube => abstractCube2Mesh(cube))

    meshes.forEach(async mesh => scene.add(await mesh))

    document.getElementsByTagName("body")[0].style.overflow = "hidden"

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

    animate()

    function animate() {
        requestAnimationFrame(animate)

        render()
    }

    const objMap = {}

    const deb = document.createElement("div")
    deb.style.position = "fixed"
    deb.style.left = "0"
    deb.style.top = "0"
    deb.style.width = "400px"
    // deb.style.height = "500px"
    deb.style.backgroundColor = "rgba(0, 0, 0, 0.75)"
    deb.style.zIndex = "100000"
    deb.style.wordBreak = "break-all"
    deb.id = "deb123"
    deb.style.padding = "1rem"
    deb.innerText = "test123"
    document.body.appendChild(deb)

    function render() {
        camera.updateMatrixWorld()

        // update the picking ray with the camera and mouse position
        raycaster.setFromCamera(mouse, camera)

        // calculate objects intersecting the picking ray
        const intersects = raycaster.intersectObjects(scene.children)

        if (intersects.length > 0) {
            const object = intersects[0].object
            deb.innerText =
                JSON.stringify(
                    object.userData.domNode.getBoundingClientRect()
                ) +
                "\n\n" +
                JSON.stringify(object.position)

            // objMap[object.id] = object.material.color.clone()
            // object.material.color.set(0xff0000)
        }

        // if (objMap) {
        //     for (const [key, value] of Object.entries(objMap)) {
        //         if (objMap[key]) {
        //             const obj = scene.getObjectById(key)
        //             if (obj) {
        //                 obj.material.color = value
        //                 objMap[key] = undefined
        //             } else {
        //                 console.log("no obj for key: ", key)
        //             }
        //         }
        //     }
        // } else {
        //     console.log("not there")
        // }

        renderer.render(scene, camera)
    }

    function onMouseMove(event) {
        // calculate mouse position in normalized device coordinates
        // (-1 to +1) for both components

        mouse.x = (event.clientX / window.innerWidth) * 2 - 1
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
    }

    window.addEventListener("mousemove", onMouseMove, false)
}
