/**
 * Admin Seed Script
 * Seeds the initial admin user into the database.
 * Run: node utils/seedAdmin.js
 */
const dotenv = require('dotenv');
dotenv.config();

const mongoose = require('mongoose');
const User = require('../models/User');
const { ROLES } = require('../config/constants');
const connectDB = require('../config/db');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@felicity.iiit.ac.in';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123';

const seedAdmin = async () => {
    try {
        await connectDB();

        const existingAdmin = await User.findOne({ role: ROLES.ADMIN });
        if (existingAdmin) {
            console.log(`⚠️  Admin already exists: ${existingAdmin.email}`);
            process.exit(0);
        }

        const admin = await User.create({
            firstName: 'System',
            lastName: 'Admin',
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD,
            role: ROLES.ADMIN,
        });

        console.log(`✅ Admin created successfully!`);
        console.log(`   Email:    ${admin.email}`);
        console.log(`   Password: ${ADMIN_PASSWORD}`);
        process.exit(0);
    } catch (error) {
        console.error('❌ Failed to seed admin:', error.message);
        process.exit(1);
    }
};

seedAdmin();
