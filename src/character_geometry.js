import * as THREE from 'three';
// Bevelled, merged garment geometry: authored facets, no extra draw call per detail.
export function tailoredGeometry(parts) {
  const positions = [], normals = [], colors = [];
  const color = new THREE.Color(), matrix = new THREE.Matrix4();
  for (const part of parts) {
    const [w,h,d,x,y,z,c,rx=0,ry=0,rz=0] = part;
    const geometry = part.round ? new THREE.SphereGeometry(1,12,10).scale(w/2,h/2,d/2) : new THREE.BoxGeometry(w,h,d,2,2,2);
    const p = geometry.attributes.position, bevel = Math.min(w,h,d) * .24;
    const inner = new THREE.Vector3(w/2-bevel,h/2-bevel,d/2-bevel);
    const v = new THREE.Vector3(), anchor = new THREE.Vector3();
    for(let i=0;!part.round && i<p.count;i++) {
      v.fromBufferAttribute(p,i); anchor.copy(v).clamp(inner.clone().negate(),inner);
      v.sub(anchor).normalize().multiplyScalar(bevel).add(anchor); p.setXYZ(i,v.x,v.y,v.z);
    }
    geometry.computeVertexNormals();
    matrix.compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(rx,ry,rz)),new THREE.Vector3(1,1,1));
    geometry.applyMatrix4(matrix);
    const flat = geometry.toNonIndexed(); color.set(c);
    for(let i=0;i<flat.attributes.position.count;i++) {
      positions.push(flat.attributes.position.getX(i),flat.attributes.position.getY(i),flat.attributes.position.getZ(i));
      const ny=flat.attributes.normal.getY(i);
      normals.push(flat.attributes.normal.getX(i),ny,flat.attributes.normal.getZ(i));
      const shade=.94+ny*.08; colors.push(color.r*shade,color.g*shade,color.b*shade);
    }
    geometry.dispose(); flat.dispose();
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  g.computeBoundingSphere(); return g;
}
