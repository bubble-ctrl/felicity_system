const User = require('../models/User');
const { ROLES } = require('../config/constants');

const seedAdmin = async () => {
    try {
        const existingAdmin = await User.findOne({ role: ROLES.ADMIN });

        if (existingAdmin) {
            console.log(`⚠️ Admin already exists: ${existingAdmin.email}`);
            return;
        }

        const admin = await User.create({
            firstName: 'System',
            lastName: 'Admin',
            email: process.env.ADMIN_EMAIL || 'admin@felicity.iiit.ac.in',
            password: process.env.ADMIN_PASSWORD || 'Admin@123',
            role: ROLES.ADMIN,
        });

        console.log('✅ Admin created successfully!');
        console.log('Email:', admin.email);
    } catch (error) {
        console.error('❌ Failed to seed admin:', error.message);
    }
};

module.exports = seedAdmin;