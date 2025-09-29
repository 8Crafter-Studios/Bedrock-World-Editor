import * as THREE from 'three'
import { Vector } from '../math/index.js'
import type { Color } from '../util/index.js'

export class Vertex {
    constructor(
        public pos: Vector,
        public color: Color,
        public texture: [number, number] | undefined,
        public textureLimit: [number, number, number, number] | undefined,
        public normal: Vector | undefined,
        public blockPos: Vector | undefined,
    ) {}

    public transform(transformation: THREE.Matrix4) {
        const temp = new THREE.Vector3(this.pos.x, this.pos.y, this.pos.z)
        temp.applyMatrix4(transformation)
        this.pos = new Vector(temp.x, temp.y, temp.z)
        return this
    }

    public static fromPos(pos: Vector) {
        return new Vertex(pos, [0, 0, 0], [0, 0], [0, 0, 0, 0], undefined, undefined)
    }
}
