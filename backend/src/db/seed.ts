import { supabase } from '../lib/supabase.js';
import bcrypt from 'bcryptjs';

async function main() {
  console.log('🌱 Seeding database...');

  // Create default admin user
  const adminPassword = await bcrypt.hash('admin123456', 12);
  
  const { data: existingAdmin } = await supabase
    .from('admin_users')
    .select('id')
    .eq('email', 'admin@example.com')
    .single();

  if (!existingAdmin) {
    const { data: admin, error: adminError } = await supabase
      .from('admin_users')
      .insert({
        email: 'admin@example.com',
        password_hash: adminPassword,
        name: 'Admin',
        role: 'SUPER_ADMIN',
      })
      .select()
      .single();

    if (adminError) {
      console.error('Error creating admin:', adminError);
    } else {
      console.log('✅ Created admin user:', admin.email);
    }
  } else {
    console.log('✅ Admin user already exists');
  }

  // Create default tiers
  const tiers = [
    {
      name: 'Bronze',
      description: 'Entry-level Member Pass membership with basic benefits',
      artwork_url: 'https://example.com/nft/bronze.png',
      display_order: 1,
      supply_cap: null, // Unlimited
      minting_open: true,
      price: 0.1,
    },
    {
      name: 'Silver',
      description: 'Silver tier membership with enhanced trading benefits',
      artwork_url: 'https://example.com/nft/silver.png',
      display_order: 2,
      supply_cap: 1500,
      minting_open: true,
      price: 0.5,
    },
    {
      name: 'Gold',
      description: 'Premium Gold tier with exclusive access and maximum benefits',
      artwork_url: 'https://example.com/nft/gold.png',
      display_order: 3,
      supply_cap: 500,
      minting_open: false, // Closed - airdrop only
      price: 1.0,
    },
  ];

  for (const tierData of tiers) {
    const { data: existing } = await supabase
      .from('tiers')
      .select('id')
      .eq('name', tierData.name)
      .single();

    if (!existing) {
      const { data: tier, error } = await supabase
        .from('tiers')
        .insert(tierData)
        .select()
        .single();

      if (error) {
        console.error(`Error creating tier ${tierData.name}:`, error);
      } else {
        console.log('✅ Created tier:', tier.name);
      }
    } else {
      // Update existing tier
      const { error } = await supabase
        .from('tiers')
        .update(tierData)
        .eq('name', tierData.name);

      if (error) {
        console.error(`Error updating tier ${tierData.name}:`, error);
      } else {
        console.log('✅ Updated tier:', tierData.name);
      }
    }
  }

  console.log('🎉 Seeding complete!');
}

main().catch((e) => {
  console.error('❌ Seeding error:', e);
  process.exit(1);
});

