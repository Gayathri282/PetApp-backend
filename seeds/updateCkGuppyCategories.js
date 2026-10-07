const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User');

const GUPPY_BREEDS = [
  'AFR',
  'AFR Big dorsal (new)',
  'AFR White Ear',
  'Albino Full Red High Dorsal',
  'Albino Golden Glass Belly',
  'Albino Golden Glass Belly Ribbon',
  'Albino Koi',
  'Albino Koi Glass belly',
  'Albino Koi GullEar Ribbon',
  'Albino Koi Red Ear',
  'Albino Lazuli Blue Red Tail',
  'Albino Metal red rose tail',
  'Albino Milky Pink',
  'Albino Platinum Dumbo Ear',
  'Albino Platinum white',
  'Albino Red Texido big ear',
  'Albino Silver Lace',
  'Albino Silverado',
  'Albino Silverado red ear (new)',
  'Albino Snake Skin Dragon',
  'Black Snake Skin Cobra',
  'Blonde koi Short Body',
  'Blonde Yellow Mosaic',
  'Blonde Yellow Mosaic Ribbon',
  'Blue Diamond',
  'Blue Diamond Big Ear',
  'Blue grass',
  'Blue Grass Ribbon',
  'Blue koi',
  'Blue Panda',
  'Blue Panda Ribbon',
  'Chilli Mosaic',
  'Chilli mosaic Dumbo Ear',
  'Dark Electric Blue',
  'Dark knight red dragon Halfmoon',
  'Dark purple',
  'Flamingo Red',
  'Full Black',
  'Full Black Big Ear',
  'Full Gold',
  'Full Gold Galwing Ribbon',
  'Full Red Black Eye',
  'Galaxy Blue Tiger',
  'Galaxy crown Tail',
  'Golden glass Belly short Body',
  'Golden Yellow Dragon',
  'Green Jaguar',
  'HB blue',
  'HB Red cauli Dorsal',
  'Ivory Green',
  'Ivory purple Mosaic',
  'Ivory Red Mosaic',
  'Japan Blue Big Ear',
  'Japan Blue Red Tail',
  'Japan Blue Tail',
  'Japan Blue Tail ribbon',
  'Japanese Blue mosaic',
  'Lazuli Blue Red Tail',
  'Metal black lace',
  'Metal black Lace super short body',
  'Metal Red Rose Tail',
  'Metal Yellow Leopard',
  'Moscow Green',
  'Peacock Red High Dorsal',
  'Pinku Delta',
  'Pingu Delta Ribbon',
  'Platinum Blue Dragon Big Ear',
  'Platinum green Black Dragon',
  'Platinum Koi big/dumbo Ear',
  'Platinum Red',
  'Platinum Red Short Body',
  'Platinum Red Tail Big Ear Half Moon',
  'Platinum RedTail big ear',
  'Platinum white dumbo Ear',
  'Purpleberry Blue Dragon Big Ear',
  'Red bar Endler',
  'Red Dragon Dumbo Ear',
  'Red Dragon Round Tail',
  'Red Grass',
  'Red Head Santa',
  'Red Lace Double Sword Tail',
  'Red Lace guppy',
  'Red Tuxedo Koi',
  'Royal Red Lace',
  'Santa Clause',
  'Santa Clause Short Body',
  'Santa Koi Short Body',
  'Santa new linage',
  'See-through Koi',
  'See-through Pingu',
  'Shreelankan/Snow White',
  'Silverado',
  'Silverado Dark Knight Red Dragon',
  'Silverado HB Blue',
  'Silverado HB Pastel',
  'Silverado HB White',
  'Silverado Moscow',
  'Silverado Red',
  'Silverado Super Red',
  'Silverado Yellow',
  'Silverado Yellow Lace',
  'Super Red Dragon',
  'Tuxedo Koi',
  'White Koi',
  'White texido ribbon',
  'Yellow Lace',
  'Yellow Lace golden Glass belly',
  'Yellow Lace top sword Tail',
  'Yellow Texido',
  'Yellow Tiger-Halfmoon',
  'Zinga Blue Black Tail',
];

const DEFAULT_CK_CUSTOM_CATEGORIES = [
  {
    name: 'Guppy',
    breeds: GUPPY_BREEDS,
  },
  {
    name: 'Albino',
    breeds: GUPPY_BREEDS.filter((b) => b.toLowerCase().includes('albino') || b.startsWith('AFR')),
  },
  {
    name: 'Blue',
    breeds: GUPPY_BREEDS.filter((b) => b.toLowerCase().includes('blue') || b.toLowerCase().includes('moscow') || b.toLowerCase().includes('lazuli')),
  },
  {
    name: 'Red',
    breeds: GUPPY_BREEDS.filter((b) => b.toLowerCase().includes('red') || b.toLowerCase().includes('santa') || b.startsWith('AFR')),
  },
  {
    name: 'Koi',
    breeds: GUPPY_BREEDS.filter((b) => b.toLowerCase().includes('koi') || b.toLowerCase().includes('santa')),
  },
  {
    name: 'Platinum',
    breeds: GUPPY_BREEDS.filter((b) => b.toLowerCase().includes('platinum')),
  },
  {
    name: 'Black',
    breeds: GUPPY_BREEDS.filter((b) => b.toLowerCase().includes('black') || b.toLowerCase().includes('dark')),
  },
  {
    name: 'Gold & Yellow',
    breeds: GUPPY_BREEDS.filter((b) => b.toLowerCase().includes('gold') || b.toLowerCase().includes('yellow') || b.toLowerCase().includes('blonde')),
  },
  {
    name: 'Silverado',
    breeds: GUPPY_BREEDS.filter((b) => b.toLowerCase().includes('silverado')),
  },
  {
    name: 'Mosaic',
    breeds: GUPPY_BREEDS.filter((b) => b.toLowerCase().includes('mosaic') || b.toLowerCase().includes('pingu') || b.toLowerCase().includes('delta')),
  },
  {
    name: 'Dragon',
    breeds: GUPPY_BREEDS.filter((b) => b.toLowerCase().includes('dragon')),
  },
];

async function updateCkGuppies() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/petapp';
    console.log('Connecting to MongoDB:', mongoUri);
    await mongoose.connect(mongoUri);

    const vendors = await User.find({
      $or: [
        { email: new RegExp('contact.ckguppyfarm@gmail.com', 'i') },
        { name: 'CK Guppies' },
        { name: 'CK Guppies & Bettas' },
      ],
    });

    if (vendors.length === 0) {
      console.log('No CK Guppies vendor user found in database.');
    } else {
      for (const vendor of vendors) {
        if (!vendor.vendorDetails) vendor.vendorDetails = {};
        vendor.role = 'vendor';
        vendor.vendorApproved = true;
        vendor.vendorDetails.customCategories = DEFAULT_CK_CUSTOM_CATEGORIES;
        await vendor.save();
        console.log(`✅ Successfully updated CK Guppies categories & breeds for: ${vendor.email} (${vendor._id})`);
      }
    }

    mongoose.disconnect();
  } catch (err) {
    console.error('Error updating CK Guppies:', err);
    process.exit(1);
  }
}

updateCkGuppies();
