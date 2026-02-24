const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES, PARTICIPANT_TYPES } = require('../config/constants');

const userSchema = new mongoose.Schema(
    {
        firstName: {
            type: String,
            trim: true,
        },
        lastName: {
            type: String,
            trim: true,
        },
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            lowercase: true,
            trim: true,
            match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
        },
        password: {
            type: String,
            required: [true, 'Password is required'],
            minlength: [6, 'Password must be at least 6 characters'],
            select: false, // Don't return password in queries by default
        },
        role: {
            type: String,
            enum: Object.values(ROLES),
            required: [true, 'Role is required'],
        },
        participantType: {
            type: String,
            enum: Object.values(PARTICIPANT_TYPES),
            // Required only for participants — validated in controller
        },
        contactNumber: {
            type: String,
            trim: true,
        },
        collegeOrOrg: {
            type: String,
            trim: true,
        },
        // Participant-specific fields
        interests: [{ type: String }],
        followedClubs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        onboardingCompleted: {
            type: Boolean,
            default: false,
        },
        // Organizer-specific fields
        organizerName: {
            type: String,
            trim: true,
        },
        category: {
            type: String,
            trim: true,
        },
        description: {
            type: String,
            trim: true,
        },
        contactEmail: {
            type: String,
            trim: true,
        },
        discordWebhookUrl: {
            type: String,
            trim: true,
        },
        // Account management
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    }
);

// ---- Pre-save hook: hash password ----
userSchema.pre('save', async function () {
    // Only hash if password was modified
    if (!this.isModified('password')) return;

    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
});

// ---- Instance method: compare password ----
userSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

// ---- Remove sensitive fields from JSON output ----
userSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.password;
    delete obj.__v;
    return obj;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
