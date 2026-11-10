import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../assets/vendor/three.js';
import {createApparatusCamera,resizeApparatusCamera} from '../assets/three/camera.js';
import {finish,housing} from '../assets/three/engineering.js';

test('shared camera preserves framing across widths without moving the orbit',()=>{
  const spec={position:[0,0,5],target:[0,0,0],span:4};
  for(const aspect of [.8,1.6,2.4]){
    const camera=createApparatusCamera(spec,aspect);assert(camera.isPerspectiveCamera);
    const h=spec.span/Math.min(aspect,1.6);
    const edge=new T.Vector3(h*aspect/2,h/2,0).project(camera);
    assert(Math.abs(edge.x-1)<1e-6&&Math.abs(edge.y-1)<1e-6);
    const p=camera.position.clone();resizeApparatusCamera(camera,spec,1.2);assert.deepEqual(camera.position,p);
  }
  assert(createApparatusCamera({...spec,projection:'orthographic'}).isOrthographicCamera);
});

test('engineering parts retain dimensions and genuinely distinct material properties',()=>{
  const steel=finish('steel'),rubber=finish('rubber'),paint=finish('paint');
  assert(steel.metalness>.75&&rubber.metalness===0&&paint.metalness<.2);
  assert(steel.roughnessMap?.isDataTexture&&rubber.roughness>paint.roughness);
  const root=new T.Group(),part=housing(root,'frame',[1,.2,.4],[0,0,0],'aluminium');
  part.geometry.computeBoundingBox();const size=part.geometry.boundingBox.getSize(new T.Vector3());
  for(const [actual,expected] of [[size.x,1],[size.y,.2],[size.z,.4]])assert(Math.abs(actual-expected)<1e-6);
});
