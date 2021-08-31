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

export default Util
