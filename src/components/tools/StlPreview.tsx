"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";

type StlPreviewProps = {
  buffer: ArrayBuffer | null;
  emptyLabel: string;
  controlsHint?: string;
};

export function StlPreview({ buffer, emptyLabel, controlsHint }: StlPreviewProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !buffer) return;

    const width = host.clientWidth || 480;
    const height = host.clientHeight || 320;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf4fbf8);

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 5000);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    host.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffffff, 0.7);
    key.position.set(60, 140, 40);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.35);
    fill.position.set(-50, 60, -30);
    scene.add(fill);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.enableZoom = true;
    controls.panSpeed = 0.9;
    controls.rotateSpeed = 0.85;
    controls.zoomSpeed = 1.05;
    controls.minDistance = 0.5;
    // Look down onto the terrain top (Y up)
    const fitCamera = (maxDim: number) => {
      camera.position.set(maxDim * 0.95, maxDim * 1.15, maxDim * 0.95);
      camera.up.set(0, 1, 0);
      controls.target.set(0, 0, 0);
      controls.minDistance = Math.max(maxDim * 0.08, 0.5);
      controls.maxDistance = maxDim * 8;
      controls.update();
    };

    const loader = new STLLoader();
    const geometry = loader.parse(buffer);
    // STL is Z-up (print); Three.js is Y-up
    geometry.rotateX(-Math.PI / 2);
    geometry.computeVertexNormals();
    geometry.center();

    const material = new THREE.MeshStandardMaterial({
      color: 0xd0d0d0,
      metalness: 0,
      roughness: 0.55,
      flatShading: false,
      side: THREE.FrontSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const box = new THREE.Box3().setFromObject(mesh);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 1);
    fitCamera(maxDim);

    const onDoubleClick = () => {
      fitCamera(maxDim);
    };
    renderer.domElement.addEventListener("dblclick", onDoubleClick);

    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const w = host.clientWidth || width;
      const h = host.clientHeight || height;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("dblclick", onDoubleClick);
      controls.dispose();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === host) {
        host.removeChild(renderer.domElement);
      }
    };
  }, [buffer]);

  if (!buffer) {
    return (
      <div className="flex h-72 items-center justify-center border border-dashed border-line bg-surface/30 text-sm text-ink-muted">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div
        ref={hostRef}
        className="h-80 w-full cursor-grab overflow-hidden border border-line bg-[#f4fbf8] active:cursor-grabbing"
      />
      {controlsHint ? (
        <p className="text-[11px] text-ink-muted">{controlsHint}</p>
      ) : null}
    </div>
  );
}
