const User = require('../models/User');
const { ROLES } = require('../config/constants');

const seedAdmin = async () => {
    console.log('🟡 Running seedAdmin...');

    try {
        console.log('🟡 Checking for existing admin...');

        const existingAdmin = await User.findOne({ role: ROLES.ADMIN });

        if (existingAdmin) {
            console.log('⚠️ Admin already exists:', existingAdmin.email);
            return;
        }

        console.log('🟡 No admin found. Creating one...');

        console.log('Using email:', process.env.ADMIN_EMAIL);
        console.log('Using password:', process.env.ADMIN_PASSWORD ? 'SET' : 'NOT SET');

        const admin = await User.create({
            firstName: 'System',
            lastName: 'Admin',
            email: process.env.ADMIN_EMAIL,
            password: process.env.ADMIN_PASSWORD,
            role: ROLES.ADMIN,
        });

        console.log('✅ Admin created:', admin.email);
    } catch (err) {
        console.error('❌ seedAdmin error:', err);
    }
};

module.exports = seedAdmin;