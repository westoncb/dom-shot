import { Color, Sphere, Vector3, Vector2 } from "three"

class Util {
    static findNodesWithType(node, objectType, results = []) {
        if (node.userData?.objectType === objectType) {
            results.push(node)
        }

        for (const child of node.children) {
            Util.findNodesWithType(child, objectType, results)
        }

        return results
    }
}

export function easeOutQuint(x) {
    return 1 - Math.pow(1 - x, 5)
}

export function easeOutBack(x) {
    const c1 = 1.70158
    const c3 = c1 + 1

    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
}

export function easeInOutSine(x) {
    return -(Math.cos(Math.PI * x) - 1) / 2
}

export function obj3dIntersection(obj1, obj2, twoD = false) {
    const sphere1 = boundingSphereForObj3d(obj1)
    const sphere2 = boundingSphereForObj3d(obj2)

    if (twoD) {
        sphere1.center.z = 0
        sphere2.center.z = 0
    }

    const center2center = sphere2.center.clone().sub(sphere1.center)
    const intersects = center2center.length() < sphere1.radius + sphere2.radius
    if (!intersects) {
        return null
    } else {
        const diff = sphere1.radius + sphere2.radius - center2center.length()
        return center2center.normalize().multiplyScalar(diff)
    }
}

export function boundingSphereForObj3d(obj3d) {
    let biggest = new Sphere(new Vector3(), 0)
    obj3d.traverse(node => {
        if (node.geometry) {
            if (!node.geometry.boundingSphere) {
                node.geometry.computeBoundingSphere()
            }
            if (node.geometry.boundingSphere.radius > biggest.radius) {
                biggest = node.geometry.boundingSphere.clone()
            }
        }
    })

    biggest.center.add(obj3d.position)

    return biggest
}

export function rand(min, max) {
    // switch if necessary
    if (min > max) {
        const temp = max
        max = min
        min = temp
    }

    return Math.random() * (max - min) + min
}

export function colorBetween(colorA, colorB) {
    const c = new Color()
    c.r = rand(colorA.r, colorB.r)
    c.g = rand(colorA.g, colorB.g)
    c.b = rand(colorA.b, colorB.b)

    return c
}

export function vectorBetween2d(vecA, vecB) {
    const v = new Vector2()
    v.x = rand(vecA.x, vecB.x)
    v.y = rand(vecA.y, vecB.y)

    return v
}

export function vectorRotatedBetween(vecA, vecB) {
    const angle = vecA.angleTo(vecB)

    if (angle === 0) {
        return vecA.clone()
    }

    const randAngle = rand(0, angle)
    const alpha = randAngle / angle
    return vecA.clone().lerp(vecB, alpha)
}

export default Util
