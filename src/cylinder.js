import { Vector2, Vector3 } from "three"

class Cylinder {
    constructor(radius, height, center) {
        this.radius = radius
        this.height = height
        this.center = center
    }

    containsPoint(point) {
        const point2d = new Vector2(point.x, point.y)
        const center2d = new Vector2(this.center.x, this.center.y)

        const centerDist = point2d.clone().sub(center2d).length()
        const cylinderTop = this.center.z + this.height / 2
        const cylinderBottom = this.center.z - this.height / 2

        // console.log(centerDist, cylinderBottom, point.z)

        return (
            centerDist < this.radius &&
            point.z >= cylinderBottom &&
            point.z <= cylinderTop
        )
    }
}

export default Cylinder
