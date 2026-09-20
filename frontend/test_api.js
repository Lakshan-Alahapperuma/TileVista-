const fs = require('fs');
const path = require('path');
const category = 'beds';
let folderName = category;
if (category === 'dressing_table') folderName = 'dressing_table';
if (category === 'runners_rugs') folderName = 'runners_and_small_rugs';
const dirPath = path.join(process.cwd(), 'public', 'images', 'furniture', folderName);
console.log('Exists?', fs.existsSync(dirPath), dirPath);
const files = fs.readdirSync(dirPath);
files.forEach(file => {
  const baseName = file.replace(/\.(webp|png|jpg|jpeg|avif|glb|gltf)$/i, '');
  console.log({
    id: `${category}_${baseName}`,
    name: baseName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    type: category
  });
});
