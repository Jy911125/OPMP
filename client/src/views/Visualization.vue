<template>
  <div class="visualization-page">
    <div class="viz-header">
      <h2>3D 可视化</h2>
      <div class="viz-controls">
        <el-button-group>
          <el-button :type="viewMode === 'server' ? 'primary' : 'default'" size="small" @click="viewMode = 'server'">服务器视图</el-button>
          <el-button :type="viewMode === 'containers' ? 'primary' : 'default'" size="small" @click="viewMode = 'containers'">容器视图</el-button>
          <el-button :type="viewMode === 'network' ? 'primary' : 'default'" size="small" @click="viewMode = 'network'">网络拓扑</el-button>
        </el-button-group>
        <el-button size="small" @click="resetCamera">重置视角</el-button>
      </div>
    </div>
    <div ref="threeContainer" class="three-container"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useMonitorStore } from '@/stores/monitor';
import { useDockerStore } from '@/stores/docker';

const threeContainer = ref<HTMLDivElement>();
const viewMode = ref<'server' | 'containers' | 'network'>('server');

const monitorStore = useMonitorStore();
const dockerStore = useDockerStore();

let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let controls: OrbitControls;
let animationId: number;
let objects: THREE.Object3D[] = [];

function initThree() {
  if (!threeContainer.value) return;

  const width = threeContainer.value.clientWidth;
  const height = threeContainer.value.clientHeight;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0e17);

  camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
  camera.position.set(10, 8, 10);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  threeContainer.value.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(10, 10, 5);
  scene.add(directionalLight);

  const gridHelper = new THREE.GridHelper(20, 20, 0x2a3544, 0x1a2332);
  scene.add(gridHelper);

  buildScene();
  animate();
}

function buildScene() {
  clearObjects();

  if (viewMode.value === 'server') {
    buildServerView();
  } else if (viewMode.value === 'containers') {
    buildContainersView();
  } else {
    buildNetworkView();
  }
}

function buildServerView() {
  const cpuUsage = monitorStore.cpuUsage / 100;
  const memUsage = monitorStore.memoryUsage / 100;
  const diskUsage = monitorStore.diskUsage / 100;

  const rackGroup = new THREE.Group();

  const rackGeometry = new THREE.BoxGeometry(4, 6, 1.5);
  const rackMaterial = new THREE.MeshStandardMaterial({ color: 0x1a2332, transparent: true, opacity: 0.8 });
  const rack = new THREE.Mesh(rackGeometry, rackMaterial);
  rackGroup.add(rack);

  const serverGeometry = new THREE.BoxGeometry(3.5, 0.3, 1.2);
  const serverCount = 10;
  for (let i = 0; i < serverCount; i++) {
    const usage = i === 0 ? cpuUsage : i === 1 ? memUsage : i === 2 ? diskUsage : Math.random() * 0.5;
    const color = new THREE.Color().lerpColors(new THREE.Color(0x22c55e), new THREE.Color(0xef4444), usage);
    const serverMaterial = new THREE.MeshStandardMaterial({ color });
    const server = new THREE.Mesh(serverGeometry, serverMaterial);
    server.position.y = -2.5 + i * 0.5;
    rackGroup.add(server);
  }

  rackGroup.position.set(0, 3, 0);
  scene.add(rackGroup);
  objects.push(rackGroup);

  const cpuGauge = createGauge('CPU', cpuUsage, -3, 0, 4);
  const memGauge = createGauge('MEM', memUsage, 0, 0, 4);
  const diskGauge = createGauge('DISK', diskUsage, 3, 0, 4);

  scene.add(cpuGauge);
  scene.add(memGauge);
  scene.add(diskGauge);
  objects.push(cpuGauge, memGauge, diskGauge);
}

function buildContainersView() {
  const containers = dockerStore.containers.slice(0, 20);
  const cols = 5;
  const spacing = 3;

  containers.forEach((container, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;

    const isRunning = container.state === 'running';
    const baseColor = isRunning ? 0x22c55e : 0x64748b;
    const height = Math.max(0.5, Math.min(2, (container.ports?.length || 1) * 0.5));

    const geometry = new THREE.BoxGeometry(1.5, height, 1.5);
    const material = new THREE.MeshStandardMaterial({
      color: baseColor,
      emissive: isRunning ? 0x22c55e : 0x000000,
      emissiveIntensity: isRunning ? 0.2 : 0
    });
    const box = new THREE.Mesh(geometry, material);
    box.position.set(col * spacing - (cols * spacing) / 2, height / 2, row * spacing);
    box.userData = { name: container.name, state: container.state };
    scene.add(box);
    objects.push(box);

    if (isRunning) {
      const glowGeometry = new THREE.BoxGeometry(1.6, height + 0.1, 1.6);
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0x22c55e,
        transparent: true,
        opacity: 0.1
      });
      const glow = new THREE.Mesh(glowGeometry, glowMaterial);
      glow.position.copy(box.position);
      scene.add(glow);
      objects.push(glow);
    }
  });
}

function buildNetworkView() {
  const nodes = [
    { name: 'Server', x: 0, z: 0, size: 1.5 },
    { name: 'Gateway', x: -4, z: 4, size: 1 },
    { name: 'Container 1', x: 4, z: 4, size: 0.8 },
    { name: 'Container 2', x: 4, z: -4, size: 0.8 },
    { name: 'Container 3', x: -4, z: -4, size: 0.8 },
  ];

  const nodeGroup = new THREE.Group();

  nodes.forEach(node => {
    const geometry = new THREE.SphereGeometry(node.size, 32, 32);
    const material = new THREE.MeshStandardMaterial({
      color: node.name === 'Server' ? 0x3b82f6 : 0x22c55e,
      metalness: 0.3,
      roughness: 0.4
    });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.set(node.x, node.size, node.z);
    nodeGroup.add(sphere);
  });

  const lineMaterial = new THREE.LineBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.6 });
  nodes.slice(1).forEach(node => {
    const points = [new THREE.Vector3(0, 1.5, 0), new THREE.Vector3(node.x, node.size, node.z)];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, lineMaterial);
    nodeGroup.add(line);
  });

  scene.add(nodeGroup);
  objects.push(nodeGroup);

  const particleGeometry = new THREE.BufferGeometry();
  const particleCount = 500;
  const positions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount * 3; i++) {
    positions[i] = (Math.random() - 0.5) * 20;
  }
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const particleMaterial = new THREE.PointsMaterial({ color: 0x06b6d4, size: 0.05, transparent: true, opacity: 0.5 });
  const particles = new THREE.Points(particleGeometry, particleMaterial);
  scene.add(particles);
  objects.push(particles);
}

function createGauge(label: string, value: number, x: number, y: number, z: number): THREE.Group {
  const group = new THREE.Group();

  const geometry = new THREE.CylinderGeometry(1, 1, 0.2, 32);
  const color = new THREE.Color().lerpColors(new THREE.Color(0x22c55e), new THREE.Color(0xef4444), value);
  const material = new THREE.MeshStandardMaterial({ color });
  const cylinder = new THREE.Mesh(geometry, material);
  cylinder.rotation.x = Math.PI / 2;
  group.add(cylinder);

  const ringGeometry = new THREE.RingGeometry(1.1, 1.3, 32, 1, 0, value * Math.PI * 2);
  const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  ring.rotation.x = -Math.PI / 2;
  ring.rotation.z = -Math.PI / 2;
  group.add(ring);

  group.position.set(x, y, z);
  return group;
}

function clearObjects() {
  objects.forEach(obj => {
    scene.remove(obj);
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      if (Array.isArray(obj.material)) {
        obj.material.forEach(m => m.dispose());
      } else {
        obj.material.dispose();
      }
    }
  });
  objects = [];
}

function resetCamera() {
  camera.position.set(10, 8, 10);
  camera.lookAt(0, 0, 0);
  controls.reset();
}

function animate() {
  animationId = requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

function handleResize() {
  if (!threeContainer.value) return;
  const width = threeContainer.value.clientWidth;
  const height = threeContainer.value.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

watch(viewMode, buildScene);
watch(() => monitorStore.cpuUsage, () => { if (viewMode.value === 'server') buildScene(); });
watch(() => dockerStore.containers.length, () => { if (viewMode.value === 'containers') buildScene(); });

onMounted(() => {
  initThree();
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  cancelAnimationFrame(animationId);
  window.removeEventListener('resize', handleResize);
  renderer?.dispose();
});
</script>

<style scoped lang="scss">
.visualization-page { display: flex; flex-direction: column; height: 100%; }
.viz-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; background: var(--opmp-bg-secondary); border-bottom: 1px solid var(--opmp-border); h2 { font-size: 18px; } }
.viz-controls { display: flex; gap: 12px; }
.three-container { flex: 1; position: relative; }
</style>
