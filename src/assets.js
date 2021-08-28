class Assets {
    static get(name) {
        return Assets[name]
    }

    static puts(name, asset) {
        return (Assets[name] = asset)
    }

    static merge(assetMap) {
        Object.keys(assetMap).forEach(key => (Assets[key] = assetMap[key]))
    }
}

export default Assets
