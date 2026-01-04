/**
 * Script para crear los íconos PNG de la extensión
 * Ejecutar: node scripts/create-icons.js
 * Requiere: npm install canvas (o usar el generador HTML alternativo)
 */

const fs = require('fs');
const path = require('path');

// Intentar usar canvas, si no está disponible, mostrar instrucciones
try {
  const { createCanvas } = require('canvas');
  
  const sizes = [16, 48, 128];
  const iconsDir = path.join(__dirname, '..', 'icons');
  
  // Crear directorio si no existe
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }
  
  sizes.forEach(size => {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    const scale = size / 128;
    
    // Fondo con gradiente
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, '#00a884');
    gradient.addColorStop(1, '#06cf9c');
    
    // Círculo de fondo
    ctx.beginPath();
    ctx.arc(size/2, size/2, size/2 - 2*scale, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
    
    // Checkmark
    ctx.beginPath();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = Math.max(2, 8 * scale);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    ctx.moveTo(94 * scale, 40 * scale);
    ctx.lineTo(54 * scale, 80 * scale);
    ctx.lineTo(34 * scale, 60 * scale);
    ctx.stroke();
    
    // Línea decorativa (solo para tamaños grandes)
    if (size >= 48) {
      ctx.beginPath();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      const x = 40 * scale;
      const y = 88 * scale;
      const w = 48 * scale;
      const h = 4 * scale;
      const r = 2 * scale;
      
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
      ctx.fill();
    }
    
    // Guardar como PNG
    const buffer = canvas.toBuffer('image/png');
    const filePath = path.join(iconsDir, `icon${size}.png`);
    fs.writeFileSync(filePath, buffer);
    console.log(`✓ Creado: ${filePath}`);
  });
  
  console.log('\n¡Íconos creados exitosamente!');
  
} catch (error) {
  console.log('=====================================');
  console.log('  INSTRUCCIONES PARA CREAR ÍCONOS');
  console.log('=====================================\n');
  
  if (error.code === 'MODULE_NOT_FOUND') {
    console.log('El módulo "canvas" no está instalado.\n');
    console.log('OPCIÓN 1: Instalar canvas y ejecutar de nuevo');
    console.log('  npm install canvas');
    console.log('  node scripts/create-icons.js\n');
  }
  
  console.log('OPCIÓN 2: Usar el generador HTML (recomendado)');
  console.log('  1. Abre icons/generate-icons.html en tu navegador');
  console.log('  2. Haz clic en cada botón para descargar los íconos');
  console.log('  3. Mueve los archivos a la carpeta icons/\n');
  
  console.log('OPCIÓN 3: Usar cualquier editor de imágenes');
  console.log('  Crea 3 imágenes PNG con los tamaños:');
  console.log('  - icon16.png (16x16 px)');
  console.log('  - icon48.png (48x48 px)');
  console.log('  - icon128.png (128x128 px)\n');
}

