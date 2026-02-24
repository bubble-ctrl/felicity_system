import { join } from 'path';

const User = require(join(__dirname, '../models/User'));
const { ROLES } = require(path.join(__dirname, '../config/constants'));

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@felicity.iiit.ac.in';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123';

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
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD,
            role: ROLES.ADMIN,
        });

        console.log('✅ Admin created successfully!');
        console.log('Email:', admin.email);
    } catch (error) {
        console.error('❌ Failed to seed admin:', error.message);
    }
};

export default seedAdmin;