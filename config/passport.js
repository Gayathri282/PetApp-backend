const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

const { DEFAULT_CK_CUSTOM_CATEGORIES } = require('../data/ckGuppyCategories');

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== 'your_google_client_id'
        ? process.env.GOOGLE_CLIENT_ID
        : 'dummy-google-client-id',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_CLIENT_SECRET !== 'your_google_client_secret'
        ? process.env.GOOGLE_CLIENT_SECRET
        : 'dummy-google-client-secret',
      callbackURL: process.env.BACKEND_URL 
        ? `${process.env.BACKEND_URL.replace(/\/$/, '')}/auth/google/callback`
        : '/auth/google/callback',
      proxy: true,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = (profile.emails?.[0]?.value || '').trim();
        const escaped = email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        let user = await User.findOne({
          $or: [
            { googleId: profile.id },
            ...(email ? [{ email: new RegExp(`^${escaped}$`, 'i') }] : []),
          ],
        });

        if (!user) {
          user = await User.create({
            googleId: profile.id,
            email: email,
            name: profile.displayName || 'Pet Lover',
            avatar: profile.photos?.[0]?.value || '',
          });
          console.log(`🆕 New user created: ${user.name}`);
        } else if (!user.googleId) {
          user.googleId = profile.id;
          try { await user.save(); } catch { /* ignore non-critical save error */ }
        }

        // CK Guppies account is always an approved vendor (new or existing)
        if (email.toLowerCase() === 'contact.ckguppyfarm@gmail.com') {
          user.role = 'vendor';
          user.vendorApproved = true;
          user.name = 'CK Guppies';
          user.avatar = user.avatar || '/ck-guppies-logo.jpg';
          user.phone = '8667377338';
          user.bio = '🏆 India’s Biggest Guppy Farm 🇮🇳 | 🎉 7600+ Happy Customers | 🌿 100+ Premium Guppy Strains | 💯 Educational 🎬 No Harm to Fish';

          const existingCats = user.vendorDetails?.customCategories || [];
          const sanitizedCats = Array.isArray(existingCats) && existingCats.length > 0
            ? existingCats.map(cat => ({
                name: (typeof cat === 'string' ? cat : cat.name || cat.categoryName || 'General').trim(),
                breeds: Array.isArray(cat.breeds) ? cat.breeds : [],
              })).filter(c => c.name.length > 0)
            : DEFAULT_CK_CUSTOM_CATEGORIES;

          user.vendorDetails = {
            ...(user.vendorDetails || {}),
            businessName: 'CK Guppies',
            contactEmail: 'contact.ckguppyfarm@gmail.com',
            contactNumber: '8667377338',
            upiDetails: {
              upiId: '8667377338@paytm',
              accountHolderName: 'CK Guppies',
            },
            selectedCategories: ['Guppies', 'Fish', 'Bettas'],
            customCategories: sanitizedCats,
          };

          try {
            await user.save();
          } catch (saveErr) {
            console.error('Error updating CK Guppies vendor details:', saveErr.message);
          }
        }

        return done(null, user);
      } catch (error) {
        console.error('Passport Google Strategy error:', error);
        return done(error, null);
      }
    }
  )
);

module.exports = passport;
