import * as THREE from "three"
import Nodie from "./nodie"
import domtoimage from "dom-to-image-improved"

const ourNodes = [
    "ds123-webglcanvas",
    "ds123-loading-container",
    "wcb_debug_panel",
]

class DOM3D {
    static constructNodies() {
        const nodes = []
        const bodyNode = document.querySelectorAll("body")[0]
        collectNodes(bodyNode, nodes)

        const nodies = nodes
            .filter(acceptableNode)
            .map(node => Nodie.create(node))
        nodies.sort((a, b) => {
            return a.treeDepth - b.treeDepth
        })
        nodies.sort((a, b) => {
            // console.log("A, B", a, b)
            return (
                Number(a.domNode.style.zIndex) - Number(b.domNode.style.zIndex)
            )
        })

        return nodies
    }

    static async loadAssets() {
        const bodyNode = document.querySelectorAll("body")[0]

        try {
            const domTexture = await getDOMTex(bodyNode)
            return { domTexture }

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

function collectNodes(node, array) {
    array.push(node)

    for (const child of node.childNodes) {
        collectNodes(child, array)
    }
}

export default DOM3D
