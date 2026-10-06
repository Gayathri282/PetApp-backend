require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Product = require('../models/Product');

// High-quality, reliable, direct guppy images from Unsplash & Wikimedia Commons
const GUPPY_IMAGES = {
  red: [
    'https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1535591273668-578e31182c4f?w=800&auto=format&fit=crop',
    'https://upload.wikimedia.org/wikipedia/commons/f/f7/Poecilia_reticulata_male.jpg',
  ],
  albino: [
    'https://images.unsplash.com/photo-1520301255226-bf5f144451c1?w=800&auto=format&fit=crop',
    'https://upload.wikimedia.org/wikipedia/commons/c/c5/Guppy_02.JPG',
    'https://images.unsplash.com/photo-1571752726703-5e7d1f6a986d?w=800&auto=format&fit=crop',
  ],
  blue: [
    'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1524704654690-b56c05c78a00?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1508873696983-2df515122519?w=800&auto=format&fit=crop',
  ],
  black: [
    'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop',
    'https://upload.wikimedia.org/wikipedia/commons/a/a2/Poecilia_reticulata.jpg',
    'https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?w=800&auto=format&fit=crop',
  ],
  'gold-yellow': [
    'https://images.unsplash.com/photo-1520301255226-bf5f144451c1?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1497671954146-59a89ff626ff?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1535591273668-578e31182c4f?w=800&auto=format&fit=crop',
  ],
  koi: [
    'https://images.unsplash.com/photo-1535591273668-578e31182c4f?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?w=800&auto=format&fit=crop',
    'https://upload.wikimedia.org/wikipedia/commons/f/f7/Poecilia_reticulata_male.jpg',
  ],
  platinum: [
    'https://images.unsplash.com/photo-1571752726703-5e7d1f6a986d?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1508873696983-2df515122519?w=800&auto=format&fit=crop',
    'https://upload.wikimedia.org/wikipedia/commons/c/c5/Guppy_02.JPG',
  ],
  silverado: [
    'https://images.unsplash.com/photo-1508873696983-2df515122519?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1571752726703-5e7d1f6a986d?w=800&auto=format&fit=crop',
  ],
  snakeskin: [
    'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&auto=format&fit=crop',
    'https://upload.wikimedia.org/wikipedia/commons/a/a2/Poecilia_reticulata.jpg',
  ],
  white: [
    'https://upload.wikimedia.org/wikipedia/commons/c/c5/Guppy_02.JPG',
    'https://images.unsplash.com/photo-1571752726703-5e7d1f6a986d?w=800&auto=format&fit=crop',
  ],
  mosaic: [
    'https://images.unsplash.com/photo-1524704654690-b56c05c78a00?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?w=800&auto=format&fit=crop',
  ],
  dragon: [
    'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1535591273668-578e31182c4f?w=800&auto=format&fit=crop',
  ],
};

const SAMPLE_VIDEO_URL = 'https://assets.mixkit.co/videos/preview/mixkit-small-fish-swimming-in-an-aquarium-43336-large.mp4';

const GUPPY_VARIETIES = [
  // 1 to 19
  { no: 1, name: 'AFR', cat: 'red' },
  { no: 2, name: 'AFR Big dorsal (new)', cat: 'red' },
  { no: 3, name: 'AFR White Ear', cat: 'red' },
  { no: 4, name: 'Albino Full Red High Dorsal', cat: 'albino' },
  { no: 5, name: 'Albino Golden Glass Belly', cat: 'albino' },
  { no: 6, name: 'Albino Golden Glass Belly Ribbon', cat: 'albino' },
  { no: 7, name: 'Albino Koi', cat: 'koi' },
  { no: 8, name: 'Albino Koi Glass belly', cat: 'koi' },
  { no: 9, name: 'Albino Koi GullEar Ribbon', cat: 'koi' },
  { no: 10, name: 'Albino Koi Red Ear', cat: 'koi' },
  { no: 11, name: 'Albino Lazuli Blue Red Tail', cat: 'blue' },
  { no: 12, name: 'Albino Metal red rose tail', cat: 'albino' },
  { no: 13, name: 'Albino Milky Pink', cat: 'albino' },
  { no: 14, name: 'Albino Platinum Dumbo Ear', cat: 'platinum' },
  { no: 15, name: 'Albino Platinum white', cat: 'platinum' },
  { no: 16, name: 'Albino Red Texido big ear', cat: 'red' },
  { no: 17, name: 'Albino Silver Lace', cat: 'silverado' },
  { no: 18, name: 'Albino Silverado', cat: 'silverado' },
  { no: 19, name: 'Albino Silverado red ear (new)', cat: 'silverado' },

  // 20 to 37
  { no: 20, name: 'Albino Snake Skin Dragon', cat: 'snakeskin' },
  { no: 21, name: 'Black Snake Skin Cobra', cat: 'black' },
  { no: 22, name: 'Blonde koi Short Body', cat: 'koi' },
  { no: 23, name: 'Blonde Yellow Mosaic', cat: 'gold-yellow' },
  { no: 24, name: 'Blonde Yellow Mosaic Ribbon', cat: 'gold-yellow' },
  { no: 25, name: 'Blue Diamond', cat: 'blue' },
  { no: 26, name: 'Blue Diamond Big Ear', cat: 'blue' },
  { no: 27, name: 'Blue grass', cat: 'blue' },
  { no: 28, name: 'Blue Grass Ribbon', cat: 'blue' },
  { no: 29, name: 'Blue koi', cat: 'blue' },
  { no: 30, name: 'Blue Panda', cat: 'blue' },
  { no: 31, name: 'Blue Panda Ribbon', cat: 'blue' },
  { no: 32, name: 'Chilli Mosaic', cat: 'mosaic' },
  { no: 33, name: 'Chilli mosaic Dumbo Ear', cat: 'mosaic' },
  { no: 34, name: 'Dark Electric Blue', cat: 'blue' },
  { no: 35, name: 'Dark knight red dragon Halfmoon', cat: 'dragon' },
  { no: 36, name: 'Dark purple', cat: 'black' },
  { no: 37, name: 'Flamingo Red', cat: 'red' },

  // 38 to 57
  { no: 38, name: 'Full Black', cat: 'black' },
  { no: 39, name: 'Full Black Big Ear', cat: 'black' },
  { no: 40, name: 'Full Gold', cat: 'gold-yellow' },
  { no: 41, name: 'Full Gold Galwing Ribbon', cat: 'gold-yellow' },
  { no: 42, name: 'Full Red Black Eye', cat: 'red' },
  { no: 43, name: 'Galaxy Blue Tiger', cat: 'blue' },
  { no: 44, name: 'Galaxy crown Tail', cat: 'blue' },
  { no: 45, name: 'Golden glass Belly short Body', cat: 'gold-yellow' },
  { no: 46, name: 'Golden Yellow Dragon', cat: 'gold-yellow' },
  { no: 47, name: 'Green Jaguar', cat: 'mosaic' },
  { no: 48, name: 'HB blue', cat: 'blue' },
  { no: 49, name: 'HB Red cauli Dorsal', cat: 'red' },
  { no: 50, name: 'Ivory Green', cat: 'white' },
  { no: 51, name: 'Ivory purple Mosaic', cat: 'mosaic' },
  { no: 52, name: 'Ivory Red Mosaic', cat: 'mosaic' },
  { no: 53, name: 'Japan Blue Big Ear', cat: 'blue' },
  { no: 54, name: 'Japan Blue Red Tail', cat: 'blue' },
  { no: 55, name: 'Japan Blue Tail', cat: 'blue' },
  { no: 56, name: 'Japan Blue Tail ribbon', cat: 'blue' },
  { no: 57, name: 'Japanese Blue mosaic', cat: 'blue' },

  // 58 to 74
  { no: 58, name: 'Lazuli Blue Red Tail', cat: 'blue' },
  { no: 59, name: 'Metal black lace', cat: 'black' },
  { no: 60, name: 'Metal black Lace super short body', cat: 'black' },
  { no: 61, name: 'Metal Red Rose Tail', cat: 'red' },
  { no: 62, name: 'Metal Yellow Leopard', cat: 'gold-yellow' },
  { no: 63, name: 'Moscow Green', cat: 'blue' },
  { no: 64, name: 'Peacock Red High Dorsal', cat: 'red' },
  { no: 65, name: 'Pinku Delta', cat: 'mosaic' },
  { no: 66, name: 'Pingu Delta Ribbon', cat: 'mosaic' },
  { no: 67, name: 'Platinum Blue Dragon Big Ear', cat: 'platinum' },
  { no: 68, name: 'Platinum green Black Dragon', cat: 'platinum' },
  { no: 69, name: 'Platinum Koi big/dumbo Ear', cat: 'platinum' },
  { no: 70, name: 'Platinum Red', cat: 'platinum' },
  { no: 71, name: 'Platinum Red Short Body', cat: 'platinum' },
  { no: 72, name: 'Platinum Red Tail Big Ear Half Moon', cat: 'platinum' },
  { no: 73, name: 'Platinum RedTail big ear', cat: 'platinum' },
  { no: 74, name: 'Platinum white dumbo Ear', cat: 'platinum' },

  // 75 to 95
  { no: 75, name: 'Purpleberry Blue Dragon Big Ear', cat: 'dragon' },
  { no: 76, name: 'Red bar Endler', cat: 'red' },
  { no: 77, name: 'Red Dragon Dumbo Ear', cat: 'dragon' },
  { no: 78, name: 'Red Dragon Round Tail', cat: 'dragon' },
  { no: 79, name: 'Red Grass', cat: 'red' },
  { no: 80, name: 'Red Head Santa', cat: 'koi' },
  { no: 81, name: 'Red Lace Double Sword Tail', cat: 'red' },
  { no: 82, name: 'Red Lace guppy', cat: 'red' },
  { no: 83, name: 'Red Tuxedo Koi', cat: 'koi' },
  { no: 84, name: 'Royal Red Lace', cat: 'red' },
  { no: 85, name: 'Santa Clause', cat: 'koi' },
  { no: 86, name: 'Santa Clause Short Body', cat: 'koi' },
  { no: 87, name: 'Santa Koi Short Body', cat: 'koi' },
  { no: 88, name: 'Santa new linage', cat: 'koi' },
  { no: 89, name: 'See-through Koi', cat: 'koi' },
  { no: 90, name: 'See-through Pingu', cat: 'mosaic' },
  { no: 91, name: 'Shreelankan/Snow White', cat: 'white' },
  { no: 92, name: 'Silverado', cat: 'silverado' },
  { no: 93, name: 'Silverado Dark Knight Red Dragon', cat: 'silverado' },
  { no: 94, name: 'Silverado HB Blue', cat: 'silverado' },
  { no: 95, name: 'Silverado HB Pastel', cat: 'silverado' },

  // 96 to 111
  { no: 96, name: 'Silverado Snake Skin Red Mosaic', cat: 'silverado' },
  { no: 97, name: 'Silverado Tuxedo Koi', cat: 'silverado' },
  { no: 98, name: 'Snakeskin Blue Dragon Big Ear Half Moon Tail', cat: 'snakeskin' },
  { no: 99, name: 'Super Blue', cat: 'blue' },
  { no: 100, name: 'Texido Koi Glass belly', cat: 'koi' },
  { no: 101, name: 'Tuxedo Blue Koi', cat: 'koi' },
  { no: 102, name: 'White Koi', cat: 'white' },
  { no: 103, name: 'White Texido', cat: 'white' },
  { no: 104, name: 'White Texido Crown tail', cat: 'white' },
  { no: 105, name: 'White texido ribbon', cat: 'white' },
  { no: 106, name: 'Yellow Lace', cat: 'gold-yellow' },
  { no: 107, name: 'Yellow Lace golden Glass belly', cat: 'gold-yellow' },
  { no: 108, name: 'Yellow Lace top sword Tail', cat: 'gold-yellow' },
  { no: 109, name: 'Yellow Texido', cat: 'gold-yellow' },
  { no: 110, name: 'Yellow Tiger-Halfmoon', cat: 'gold-yellow' },
  { no: 111, name: 'Zinga Blue Black Tail', cat: 'blue' },
];

async function seedGuppies() {
  try {
    console.log('Connecting to MongoDB...');
    await connectDB();

    // 1. Find or create vendor: CK Guppies & Bettas
    let vendor = await User.findOne({
      $or: [{ email: 'contact.ckguppyfarm@gmail.com' }, { name: 'CK Guppies & Bettas' }],
    });
    if (!vendor) {
      vendor = await User.create({
        googleId: 'vendor-ck-guppies-id',
        email: 'contact.ckguppyfarm@gmail.com',
        name: 'CK Guppies & Bettas',
        avatar: '/ck-guppies-logo.jpg',
        role: 'vendor',
        vendorApproved: true,
        phone: '8667377338',
        location: {
          type: 'Point',
          coordinates: [76.2711, 9.9312], // Kochi, Kerala
        },
        address: 'Kochi, Kerala, India',
        vendorDetails: {
          upiDetails: {
            upiId: '8667377338@paytm',
            accountHolderName: 'CK Guppies & Bettas',
          },
          selectedCategories: ['Guppies', 'Fish', 'Bettas'],
        },
      });
      console.log('✅ Created Vendor: CK Guppies & Bettas (contact.ckguppyfarm@gmail.com)');
    } else {
      vendor.email = 'contact.ckguppyfarm@gmail.com';
      vendor.phone = '8667377338';
      vendor.avatar = '/ck-guppies-logo.jpg';
      vendor.bio = '🏆 India’s Biggest Guppy Farm 🇮🇳 | 🎉 7600+ Happy Customers | 🌿 100+ Premium Guppy Strains | 💯 Educational 🎬 No Harm to Fish';
      vendor.role = 'vendor';
      vendor.vendorApproved = true;
      if (vendor.vendorDetails && vendor.vendorDetails.upiDetails) {
        vendor.vendorDetails.upiDetails.upiId = '8667377338@paytm';
      }
      await vendor.save();
      console.log('ℹ️ Updated Vendor email to: contact.ckguppyfarm@gmail.com');
    }

    // 2. Clear previous seeded guppies if any
    const deleted = await Product.deleteMany({ vendor: vendor._id });
    console.log(`🧹 Cleaned ${deleted.deletedCount} existing products for CK Guppies & Bettas.`);

    // 3. Build 111 products
    const productsToInsert = GUPPY_VARIETIES.map((v, index) => {
      const categoryImages = GUPPY_IMAGES[v.cat] || GUPPY_IMAGES.blue;
      const primaryImg = categoryImages[index % categoryImages.length];
      const price = 250 + ((v.no * 17) % 950); // prices ranging between ₹250 and ₹1200

      return {
        vendor: vendor._id,
        name: `${v.no}. ${v.name}`,
        type: 'product',
        description: `Premium Healthy Guppy Variety #${v.no}: ${v.name}. High quality breeding pair / trio from CK Guppies & Bettas. Contact WhatsApp: 97473 77338.`,
        category: v.cat,
        tags: [v.cat, 'guppy', 'on sale', 'fish', 'pure breed'],
        price: price,
        isOnSale: true,
        status: 'approved',
        isLiveAnimal: true,
        deliveryChargesAdditional: true,
        shippingChargeKerala: 120,
        animalCompliance: {
          breed: `${v.name} Guppy`,
          ageInWeeks: 12,
          vaccinationStatus: 'not_applicable',
          welfareDeclarationAccepted: true,
        },
        images: [primaryImg, ...categoryImages],
        reels: [
          {
            videoUrl: SAMPLE_VIDEO_URL,
            thumbnail: primaryImg,
            order: 0,
          },
        ],
      };
    });

    const inserted = await Product.insertMany(productsToInsert);
    console.log(`🎉 Successfully seeded ${inserted.length} Guppy Variety products into database!`);

    await mongoose.disconnect();
    console.log('Done.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding error:', error);
    process.exit(1);
  }
}

seedGuppies();
