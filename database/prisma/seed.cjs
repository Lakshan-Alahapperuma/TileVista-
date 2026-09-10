const path = require('path');
try {
  process.loadEnvFile(path.resolve(__dirname, '../../.env'));
} catch (e) {
  // Gracefully fallback if the .env file is missing or already loaded
}

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding with redesigned schema (CommonJS)...');

  // 1. Clean existing records in dependency order to prevent foreign key errors
  await prisma.admin_logs.deleteMany();
  await prisma.cart_items.deleteMany();
  await prisma.carts.deleteMany();
  await prisma.design_elements.deleteMany();
  await prisma.design_openings.deleteMany();
  await prisma.design_items.deleteMany();
  await prisma.design_walls.deleteMany();
  await prisma.room_vertices.deleteMany();
  await prisma.inventory_reservations.deleteMany();
  await prisma.order_items.deleteMany();
  await prisma.order_status_history.deleteMany();
  await prisma.orders.deleteMany();
  await prisma.room_designs.deleteMany();
  await prisma.package_items.deleteMany();
  await prisma.packages.deleteMany();
  await prisma.product_asset_tags.deleteMany();
  await prisma.asset_sizes.deleteMany();
  await prisma.asset_transformations.deleteMany();
  await prisma.product_assets.deleteMany();
  await prisma.stock_thresholds.deleteMany();
  await prisma.products.deleteMany();
  await prisma.tags.deleteMany();
  await prisma.user_addresses.deleteMany();
  await prisma.notifications.deleteMany();
  await prisma.users.deleteMany();

  console.log('✅ Wiped old data.');

  // 2. Create Users
  const admin = await prisma.users.create({
    data: {
      user_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      first_name: 'TileVista',
      last_name: 'Administrator',
      email: 'admin@tilevista.com',
      password_hash: 'admin123', // plaintext fallback for development
      role: 'admin',
      status: 'active',
    },
  });

  const customer = await prisma.users.create({
    data: {
      user_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
      first_name: 'Supun',
      last_name: 'Gunasinghe',
      email: 'customer@test.com',
      password_hash: 'cust123',
      role: 'customer',
      status: 'active',
    },
  });

  console.log('✅ Created mock users: admin@tilevista.com and customer@test.com');

  // 3. Create Products and Assets
  const productData = [
    { id: 4, name: 'Akansas Grey', type: 'Tiles', material: 'Porcelain', color: 'Onyx', glb: null, img: '/uploads/images/akansas-grey-4.jpg' },
    { id: 6, name: 'Balance White', type: 'Tiles', material: 'Porcelain', color: 'White', glb: null, img: '/uploads/images/balance-white-6.jpg' },
    { id: 9, name: 'Aqua Grace', type: 'Tiles', material: 'Ceramic', color: 'Blue', glb: null, img: '/uploads/images/aqua-grace-9.png' },
    { id: 10, name: 'Mosaic -Glossy Glass (KIDAKO)', type: 'Tiles', material: 'Glass', color: 'Multicolor', glb: null, img: '/uploads/images/mosaic-glossy-glass-kidako-10.png' },
    { id: 17, name: 'Altair Natural', type: 'Tiles', material: 'Porcelain', color: 'Grey', glb: null, img: '/uploads/images/altair-natural-17.jpg' },
    { id: 18, name: 'Arke Nude', type: 'Tiles', material: 'Ceramic', color: 'Beige', glb: null, img: '/uploads/images/arke-nude-18.png' },
    { id: 20, name: 'Onia Natural', type: 'Tiles', material: 'Ceramic', color: 'Grey', glb: null, img: '/uploads/images/onia-natural-20.png' },
    { id: 21, name: 'Brasilia White', type: 'Tiles', material: 'Ceramic', color: 'White', glb: null, img: '/uploads/images/rocell-pearl-white-glossy-wall-tile-30x60-3.jpeg' },

    // Wash Basins
    { id: 22, name: 'Aqua Corner Wash Basin', type: 'Wash Basins', glb: '/uploads/models/aqua-corner-wash-basin-22.glb', img: '/uploads/images/aqua-corner-wash-basin-22.png' },
    { id: 23, name: 'Aqua Cube', type: 'Wash Basins', glb: '/uploads/models/aqua-cube-23.glb', img: '/uploads/images/aqua-cube-23.png' },
    { id: 24, name: 'Iris Wash Basin', type: 'Wash Basins', glb: '/uploads/models/iris-wash-basin-24.glb', img: '/uploads/images/iris-wash-basin-24.jpg' },
    { id: 26, name: 'Aqua 1 Wash Basin', type: 'Wash Basins', glb: '/uploads/models/aqua-1-wash-basin-26.glb', img: '/uploads/images/aqua-1-wash-basin-26.png' },
    { id: 27, name: 'Aqua 2 Wash Basin', type: 'Wash Basins', glb: '/uploads/models/aqua-2-wash-basin-27.glb', img: '/uploads/images/aqua-2-wash-basin-27.png' },
    { id: 33, name: 'Dew Point Wash Basin', type: 'Wash Basins', glb: '/uploads/models/dew-point-wash-basin-33.glb', img: '/uploads/images/dew-point-wash-basin-33.png' },

    // Water Closets
    { id: 35, name: 'Avesa Floor Mounted Water Closet', type: 'Water Closets', glb: '/uploads/models/avesa-floor-mounted-water-closet-35.glb', img: '/uploads/images/avesa-floor-mounted-water-closet-35.png' },
    { id: 38, name: 'Giuly Water Closet', type: 'Water Closets', glb: '/uploads/models/giuly-water-closet-38.glb', img: '/uploads/images/giuly-water-closet-38.png' },

    // Accessories
    { id: 42, name: 'Free Standing Bath Tub', type: 'Accessories', glb: '/uploads/models/free-standing-bath-tub-42.glb', img: '/uploads/images/free-standing-bath-tub-42.png' },
    { id: 44, name: 'Hand Shower Set', type: 'Accessories', glb: '/uploads/models/hand-shower-set-44.glb', img: '/uploads/images/hand-shower-set-44.png' },
    { id: 45, name: 'Exposed Thermostatic Shower Mixer - Chrome Finish', type: 'Accessories', glb: '/uploads/models/exposed-thermostatic-shower-mixer-chrome-finish-45.glb', img: '/uploads/images/exposed-thermostatic-shower-mixer-chrome-finish-45.png' },
    { id: 49, name: 'Rain Shower', type: 'Accessories', glb: '/uploads/models/rain-shower-49.glb', img: '/uploads/images/rain-shower-49.png' },
    { id: 50, name: 'Framed Mirrors (1000Mm X 650Mm)', type: 'Accessories', glb: '/uploads/models/framed-mirrors-1000mm-x-650mm-50.glb', img: '/uploads/images/framed-mirrors-1000mm-x-650mm-50.png' },
    { id: 52, name: 'Lumea Soap Dish Holder', type: 'Accessories', glb: '/uploads/models/lumea-soap-dish-holder-52.glb', img: '/uploads/images/lumea-soap-dish-holder-52.png' }
  ];

  const productMap = new Map();

  for (const item of productData) {
    const prodId = crypto.randomUUID();
    const assetId = crypto.randomUUID();

    const product = await prisma.products.create({
      data: {
        product_id: prodId,
        ospos_item_id: item.id,
        is_active: true,
      },
    });

    productMap.set(item.id, product);

    const asset = await prisma.product_assets.create({
      data: {
        asset_id: assetId,
        product_id: prodId,
        thumbnail_url: item.img,
        image_url: item.img,
        glb_url: item.glb,
        material_type: item.material || null,
        color_family: item.color || null,
        is_visible: true,
      },
    });

    await prisma.asset_sizes.create({
      data: {
        size_id: crypto.randomUUID(),
        asset_id: assetId,
        width: 60.0,
        height: 60.0,
        depth: 0.8,
        unit: 'cm',
      },
    });

    await prisma.asset_transformations.create({
      data: {
        transform_id: crypto.randomUUID(),
        asset_id: assetId,
        scale_x: 1.0,
        scale_y: 1.0,
        scale_z: 1.0,
        rotation_x: 0.0,
        rotation_y: 0.0,
        rotation_z: 0.0,
      },
    });
  }

  console.log('✅ Created products and assets mapped to OSPOS item catalog.');

  // 4. Create Packages
  const packagesData = [
    {
      id: 'pkg-essential-comfort',
      name: 'Essential Comfort Package',
      description: 'A practical and affordable bathroom solution designed for modern homes. This package combines Akansas Grey floor tiles with Balance White wall tiles and essential fixtures.',
      discount: 12.5,
      itemIds: [4, 6, 24, 38, 50],
      cover: '/images/packages/essential-comfort-package.jpeg',
    },
    {
      id: 'pkg-everyday-living',
      name: 'Everyday Living Package',
      description: 'A simple and stylish bathroom package that balances affordability and modern design for everyday family use.',
      discount: 9.5,
      itemIds: [20, 21, 22, 38, 50],
      cover: '/images/packages/everyday-living-package.jpeg',
    },
    {
      id: 'pkg-elegant-living',
      name: 'Elegant Living Package',
      description: 'A balanced combination of comfort and style featuring premium finishes and contemporary bathroom fixtures.',
      discount: 15.4,
      itemIds: [17, 4, 26, 35, 50, 45],
      cover: '/images/packages/elegant-living-package.jpeg',
    },
    {
      id: 'pkg-contemporary-comfort',
      name: 'Contemporary Comfort Package',
      description: 'Designed for homeowners seeking a refined bathroom with modern aesthetics and enhanced functionality.',
      discount: 14.3,
      itemIds: [18, 10, 26, 38, 50, 49],
      cover: '/images/packages/contemporary-comfort-package.jpeg',
    },
    {
      id: 'pkg-signature-white-luxury',
      name: 'Signature White Luxury Package',
      description: 'A sophisticated bathroom package inspired by modern luxury hotels, combining elegant white finishes with premium fixtures for a timeless appearance.',
      discount: 10.5,
      itemIds: [6, 21, 27, 35, 50, 49],
      cover: '/images/packages/signature-white-luxury-package.jpeg',
    },
    {
      id: 'pkg-grand-marble-suite',
      name: 'Grand Marble Suite Package',
      description: 'A complete luxury bathroom solution designed for high-end residences, featuring elegant marble finishes, premium sanitary ware, and a freestanding bathtub.',
      discount: 11.1,
      itemIds: [4, 6, 23, 35, 50, 49, 42],
      cover: '/images/packages/grand-marble-suite-package.jpeg',
    }
  ];

  for (const pkg of packagesData) {
    await prisma.packages.create({
      data: {
        package_id: pkg.id,
        package_name: pkg.name,
        description: pkg.description,
        cover_image: pkg.cover,
        discount_percentage: pkg.discount,
        status: 'active',
      },
    });

    for (const itemId of pkg.itemIds) {
      const product = productMap.get(itemId);
      if (product) {
        await prisma.package_items.create({
          data: {
            package_id: pkg.id,
            product_id: product.product_id,
            quantity: 1,
          },
        });
      }
    }
  }

  console.log('✅ Curated packages seeded successfully.');
  console.log('🌱 Seeding process completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
