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
  await prisma.design_measurements.deleteMany();
  await prisma.design_snapshots.deleteMany();
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

  // 3. Create Products and Assets (corresponding to OSPOS item ID 2)
  const prod2 = await prisma.products.create({
    data: {
      product_id: 'p0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02',
      ospos_item_id: 2,
      is_active: true,
    },
  });

  const asset2 = await prisma.product_assets.create({
    data: {
      asset_id: 's0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02',
      product_id: prod2.product_id,
      thumbnail_url: '/uploads/images/2.jpg',
      image_url: '/uploads/images/2.jpg',
      material_type: 'Ceramic',
      color_family: 'Grey',
      is_visible: true,
    },
  });

  await prisma.stock_thresholds.create({
    data: {
      threshold_id: 't0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02',
      product_id: prod2.product_id,
      threshold_value: 5,
    },
  });

  console.log('✅ Created product, threshold (5), and asset mapped to OSPOS item 2.');

  // Create default sizes and transformations for assets to prevent frontend crashes
  for (const assetId of [asset2.asset_id]) {
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

  console.log('✅ Added default sizes and transformations for all assets.');

  // 5. Create Packages
  const pkg = await prisma.packages.create({
    data: {
      package_id: 'k0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01',
      package_name: 'Opulent Marble Suite',
      description: 'A complete collection combining royal white tiles, vessel oval basin, and modern fixtures.',
      discount_percentage: 15.0,
      status: 'active',
    },
  });

  await prisma.package_items.createMany({
    data: [
      { package_id: pkg.package_id, product_id: prod2.product_id, quantity: 1 },
    ],
  });

  console.log('✅ Created mock packages.');
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
