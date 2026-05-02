const express = require('express');
const { pool } = require('../config/database');
const { simpleAuth } = require('../middleware/auth');

const router = express.Router();

// Get user referral data
router.get('/my-referral', simpleAuth, async (req, res) => {
    const client = await pool.connect();
    
    try {
        const userId = req.user.id;
        
        // Generate referral code if not exists
        let referralCode = `REF${userId.toString().padStart(6, '0')}`;
        
        // Get referral statistics
        const statsQuery = `
            SELECT 
                COUNT(*) as total_referrals,
                COUNT(CASE WHEN u.last_login > NOW() - INTERVAL '30 days' THEN 1 END) as active_referrals,
                COALESCE(SUM(r.bonus_amount), 0) as total_bonus
            FROM referrals r
            LEFT JOIN users u ON r.referred_user_id = u.id
            WHERE r.referrer_id = $1
        `;
        
        const statsResult = await client.query(statsQuery, [userId]);
        const stats = statsResult.rows[0];
        
        // Get referral list
        const referralsQuery = `
            SELECT 
                u.first_name,
                u.username,
                u.last_login,
                r.created_at,
                r.bonus_amount,
                CASE WHEN u.last_login > NOW() - INTERVAL '30 days' THEN true ELSE false END as active
            FROM referrals r
            LEFT JOIN users u ON r.referred_user_id = u.id
            WHERE r.referrer_id = $1
            ORDER BY r.created_at DESC
            LIMIT 20
        `;
        
        const referralsResult = await client.query(referralsQuery, [userId]);
        
        res.json({
            success: true,
            referral_code: referralCode,
            referral_link: `https://t.me/kelalbingo_bot?start=${referralCode}`,
            stats: {
                total_referrals: parseInt(stats.total_referrals) || 0,
                active_referrals: parseInt(stats.active_referrals) || 0,
                total_bonus: parseFloat(stats.total_bonus) || 0
            },
            referrals: referralsResult.rows
        });
        
    } catch (error) {
        console.error('Referral data error:', error);
        res.status(500).json({ error: 'Failed to load referral data' });
    } finally {
        client.release();
    }
});

// Process referral registration
router.post('/register', async (req, res) => {
    const client = await pool.connect();
    
    try {
        const { referral_code, referred_user_id } = req.body;
        
        if (!referral_code || !referred_user_id) {
            return res.status(400).json({ error: 'Missing referral data' });
        }
        
        // Extract referrer ID from referral code
        const referrerId = parseInt(referral_code.replace('REF', ''));
        
        if (isNaN(referrerId)) {
            return res.status(400).json({ error: 'Invalid referral code' });
        }
        
        // Check if referral already exists
        const existingReferral = await client.query(
            'SELECT id FROM referrals WHERE referred_user_id = $1',
            [referred_user_id]
        );
        
        if (existingReferral.rows.length > 0) {
            return res.status(400).json({ error: 'Referral already processed' });
        }
        
        // Check if referrer exists
        const referrerCheck = await client.query(
            'SELECT id FROM users WHERE id = $1',
            [referrerId]
        );
        
        if (referrerCheck.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid referrer' });
        }
        
        // Create referral record
        await client.query(
            'INSERT INTO referrals (referrer_id, referred_user_id, referral_code, bonus_amount) VALUES ($1, $2, $3, 0)',
            [referrerId, referred_user_id, referral_code]
        );
        
        // Give initial bonus to referrer (optional)
        const bonusAmount = 5; // 5 Birr bonus for successful referral
        
        await client.query(
            'UPDATE referrals SET bonus_amount = $1 WHERE referrer_id = $2 AND referred_user_id = $3',
            [bonusAmount, referrerId, referred_user_id]
        );
        
        // Update referrer's balance
        await client.query(
            'UPDATE balances SET balance = balance + $1 WHERE user_id = $2',
            [bonusAmount, referrerId]
        );
        
        // Record transaction
        await client.query(
            'INSERT INTO transactions (user_id, amount, type, description) VALUES ($1, $2, $3, $4)',
            [referrerId, bonusAmount, 'referral_bonus', `Referral bonus for user ${referred_user_id}`]
        );
        
        res.json({
            success: true,
            message: 'Referral processed successfully',
            bonus_amount: bonusAmount
        });
        
    } catch (error) {
        console.error('Referral registration error:', error);
        res.status(500).json({ error: 'Failed to process referral' });
    } finally {
        client.release();
    }
});

module.exports = router;
