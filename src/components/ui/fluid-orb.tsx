'use client';

import {useEffect,useRef,type ComponentProps} from 'react';

export type FluidOrbProps=ComponentProps<'div'>&{size?:number;color?:string};

const vertexSource='attribute vec2 a_pos; void main(){gl_Position=vec4(a_pos,0.0,1.0);}';
const fragmentSource=[
 '#ifdef GL_FRAGMENT_PRECISION_HIGH','precision highp float;','#else','precision mediump float;','#endif',
 'uniform vec2 u_resolution;','uniform float u_time;','uniform vec3 u_color;',
 'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}',
 'float noise(vec2 p){vec2 i=floor(p);vec2 f=fract(p);vec2 u=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),u.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),u.x),u.y);}',
 'float fbm(vec2 p){float value=0.0;float amplitude=0.6;for(int i=0;i<3;i++){value+=amplitude*noise(p);p*=2.0;amplitude*=0.5;}return value;}',
 'void main(){vec2 uv=gl_FragCoord.xy/u_resolution.xy;float time=u_time*0.22;vec2 drift=vec2(sin(time)+0.6*sin(time*1.7+1.3),cos(time*0.8)+0.6*cos(time*1.3+2.1));vec2 p=vec2(uv.x*1.8,uv.y)+drift*0.7;vec2 q=vec2(fbm(p+drift),fbm(p+vec2(3.2,1.5)-drift));float fluid=fbm(p+1.2*q);float shade=clamp(clamp(1.0-uv.y,0.0,1.0)+(fluid-0.5)*0.8*smoothstep(0.0,0.3,uv.y),0.0,1.0);vec3 light=mix(vec3(0.99,1.0,1.0),u_color,0.5);vec3 color=mix(vec3(0.99,1.0,1.0),light,smoothstep(0.28,0.52,shade));color=mix(color,u_color,smoothstep(0.58,0.88,shade));float edge=smoothstep(0.5,0.49,distance(uv,vec2(0.5)));gl_FragColor=vec4(color*edge,edge);}'
].join('\n');

function hexToRgb(hex:string):[number,number,number]{
 let value=hex.replace('#','').trim();
 if(value.length===3)value=value[0]+value[0]+value[1]+value[1]+value[2]+value[2];
 const parsed=Number.parseInt(value,16);
 return value.length===6&&!Number.isNaN(parsed)?[((parsed>>16)&255)/255,((parsed>>8)&255)/255,(parsed&255)/255]:[0.08,0.62,0.39];
}

function shader(gl:WebGLRenderingContext,type:number,source:string){
 const item=gl.createShader(type);if(!item)return null;gl.shaderSource(item,source);gl.compileShader(item);
 if(!gl.getShaderParameter(item,gl.COMPILE_STATUS)){gl.deleteShader(item);return null;}return item;
}

export default function FluidOrb({size=112,color='#149b69',className='',style,...props}:FluidOrbProps){
 const canvasRef=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  const canvas=canvasRef.current;if(!canvas)return;
  const gl=canvas.getContext('webgl',{antialias:true,alpha:true});if(!gl)return;
  const program=gl.createProgram(),vert=shader(gl,gl.VERTEX_SHADER,vertexSource),frag=shader(gl,gl.FRAGMENT_SHADER,fragmentSource);
  let buffer:WebGLBuffer|null=null,frame=0,intersecting=true,documentVisible=!document.hidden;
  const cleanup=()=>{cancelAnimationFrame(frame);if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);if(vert)gl.deleteShader(vert);if(frag)gl.deleteShader(frag);};
  if(!program||!vert||!frag){cleanup();return;}
  gl.attachShader(program,vert);gl.attachShader(program,frag);gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS)){cleanup();return;}
  buffer=gl.createBuffer();if(!buffer){cleanup();return;}
  gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  const position=gl.getAttribLocation(program,'a_pos');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
  const resolution=gl.getUniformLocation(program,'u_resolution'),time=gl.getUniformLocation(program,'u_time'),tone=gl.getUniformLocation(program,'u_color');
  const pixels=Math.round(size*Math.min(window.devicePixelRatio||1,2));canvas.width=pixels;canvas.height=pixels;gl.viewport(0,0,pixels,pixels);if(tone)gl.uniform3f(tone,...hexToRgb(color));if(resolution)gl.uniform2f(resolution,pixels,pixels);
  const motion=window.matchMedia('(prefers-reduced-motion: reduce)'),start=performance.now();
  const paint=(now:number)=>{if(time)gl.uniform1f(time,motion.matches?0:(now-start)/1000);gl.drawArrays(gl.TRIANGLES,0,6);};
  const animate=(now:number)=>{paint(now);if(!motion.matches&&intersecting&&documentVisible)frame=requestAnimationFrame(animate);};
  const restart=()=>{cancelAnimationFrame(frame);paint(performance.now());if(!motion.matches&&intersecting&&documentVisible)frame=requestAnimationFrame(animate);};
  const observer=new IntersectionObserver(([entry])=>{intersecting=entry.isIntersecting;restart();},{threshold:0});
  const onVisibility=()=>{documentVisible=!document.hidden;restart();};
  observer.observe(canvas);document.addEventListener('visibilitychange',onVisibility);motion.addEventListener('change',restart);restart();
  return()=>{observer.disconnect();document.removeEventListener('visibilitychange',onVisibility);motion.removeEventListener('change',restart);cleanup();};
 },[size,color]);
 return <div className={('fluid-orb '+className).trim()} style={{width:size,height:size,...style}} {...props}><canvas ref={canvasRef} className="fluid-orb-canvas"/></div>;
}
