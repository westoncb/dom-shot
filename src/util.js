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

export default Util
