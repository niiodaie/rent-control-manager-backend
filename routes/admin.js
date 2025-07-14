const express = require('express');
const Stripe = require('stripe');
const router = express.Router();

// Initialize Stripe with secret key
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Middleware for admin authentication (simplified for demo)
const requireAdmin = (req, res, next) => {
  // In production, implement proper admin authentication
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Get dashboard analytics
router.get('/analytics', requireAdmin, async (req, res) => {
  try {
    // In production, these would come from your database
    const analytics = {
      totalUsers: 1247,
      activeSubscriptions: 892,
      monthlyRevenue: 44650,
      totalProperties: 3421,
      growthRate: 12.5,
      churnRate: 2.1,
      revenueGrowth: 18.3,
      newUsersThisMonth: 156,
      cancelledSubscriptions: 23
    };

    res.json({ analytics });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Get all users with pagination
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, search, status } = req.query;
    
    // In production, implement actual database queries
    const mockUsers = [
      {
        id: '1',
        name: 'John Smith',
        email: 'john@example.com',
        plan: 'Professional',
        status: 'active',
        properties: 5,
        joinDate: '2024-01-15',
        lastActive: '2024-01-20',
        revenue: 599.88,
        subscriptionId: 'sub_1234567890',
        customerId: 'cus_1234567890'
      },
      {
        id: '2',
        name: 'Sarah Johnson',
        email: 'sarah@example.com',
        plan: 'Premium',
        status: 'active',
        properties: 12,
        joinDate: '2024-01-10',
        lastActive: '2024-01-19',
        revenue: 1199.88,
        subscriptionId: 'sub_0987654321',
        customerId: 'cus_0987654321'
      },
      {
        id: '3',
        name: 'Mike Wilson',
        email: 'mike@example.com',
        plan: 'Starter',
        status: 'trial',
        properties: 1,
        joinDate: '2024-01-18',
        lastActive: '2024-01-20',
        revenue: 0,
        subscriptionId: 'sub_1122334455',
        customerId: 'cus_1122334455'
      }
    ];

    // Apply filters
    let filteredUsers = mockUsers;
    
    if (search) {
      filteredUsers = filteredUsers.filter(user => 
        user.name.toLowerCase().includes(search.toLowerCase()) ||
        user.email.toLowerCase().includes(search.toLowerCase())
      );
    }
    
    if (status && status !== 'all') {
      filteredUsers = filteredUsers.filter(user => user.status === status);
    }

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

    res.json({
      users: paginatedUsers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: filteredUsers.length,
        pages: Math.ceil(filteredUsers.length / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get user details
router.get('/users/:userId', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // In production, fetch from database
    const user = {
      id: userId,
      name: 'John Smith',
      email: 'john@example.com',
      plan: 'Professional',
      status: 'active',
      properties: 5,
      joinDate: '2024-01-15',
      lastActive: '2024-01-20',
      revenue: 599.88,
      subscriptionId: 'sub_1234567890',
      customerId: 'cus_1234567890',
      paymentHistory: [
        {
          id: 'pi_1234567890',
          amount: 49.99,
          status: 'succeeded',
          date: '2024-01-15',
          description: 'Professional Plan - Monthly'
        }
      ]
    };

    res.json({ user });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Update user
router.put('/users/:userId', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, email, plan, status } = req.body;
    
    // In production, update database and Stripe customer
    console.log(`Updating user ${userId}:`, { name, email, plan, status });
    
    res.json({ 
      message: 'User updated successfully',
      user: { id: userId, name, email, plan, status }
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user
router.delete('/users/:userId', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // In production, implement proper user deletion
    // 1. Cancel all subscriptions
    // 2. Delete from database
    // 3. Clean up Stripe customer
    
    console.log(`Deleting user ${userId}`);
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Get all subscriptions
router.get('/subscriptions', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, status } = req.query;
    
    // Fetch from Stripe
    const subscriptions = await stripe.subscriptions.list({
      limit: parseInt(limit),
      starting_after: page > 1 ? `sub_${(page - 1) * limit}` : undefined,
      expand: ['data.customer', 'data.items.data.price.product']
    });

    const formattedSubscriptions = subscriptions.data.map(sub => ({
      id: sub.id,
      customerId: sub.customer.id,
      customerEmail: sub.customer.email,
      status: sub.status,
      plan: sub.items.data[0]?.price?.nickname || 'Unknown',
      amount: sub.items.data[0]?.price?.unit_amount / 100,
      interval: sub.items.data[0]?.price?.recurring?.interval,
      currentPeriodStart: sub.current_period_start,
      currentPeriodEnd: sub.current_period_end,
      trialEnd: sub.trial_end,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      created: sub.created
    }));

    res.json({
      subscriptions: formattedSubscriptions,
      hasMore: subscriptions.has_more
    });
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
});

// Cancel subscription
router.post('/subscriptions/:subscriptionId/cancel', requireAdmin, async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const { cancelAtPeriodEnd = true, reason } = req.body;

    let subscription;
    
    if (cancelAtPeriodEnd) {
      subscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
        metadata: {
          cancellation_reason: reason || 'Admin cancellation'
        }
      });
    } else {
      subscription = await stripe.subscriptions.cancel(subscriptionId, {
        prorate: true
      });
    }

    res.json({
      message: 'Subscription cancelled successfully',
      subscription: {
        id: subscription.id,
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        canceledAt: subscription.canceled_at
      }
    });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// Process refund
router.post('/refunds', requireAdmin, async (req, res) => {
  try {
    const { paymentIntentId, amount, reason = 'requested_by_customer' } = req.body;

    if (!paymentIntentId) {
      return res.status(400).json({ error: 'Payment intent ID is required' });
    }

    const refundData = {
      payment_intent: paymentIntentId,
      reason: reason
    };

    if (amount) {
      refundData.amount = Math.round(amount * 100); // Convert to cents
    }

    const refund = await stripe.refunds.create(refundData);

    res.json({
      message: 'Refund processed successfully',
      refund: {
        id: refund.id,
        amount: refund.amount / 100,
        status: refund.status,
        reason: refund.reason
      }
    });
  } catch (error) {
    console.error('Error processing refund:', error);
    res.status(500).json({ error: 'Failed to process refund' });
  }
});

// Get payment history
router.get('/payments', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, customerId } = req.query;
    
    const queryParams = {
      limit: parseInt(limit),
      expand: ['data.customer']
    };

    if (customerId) {
      queryParams.customer = customerId;
    }

    if (page > 1) {
      queryParams.starting_after = `pi_${(page - 1) * limit}`;
    }

    const payments = await stripe.paymentIntents.list(queryParams);

    const formattedPayments = payments.data.map(payment => ({
      id: payment.id,
      amount: payment.amount / 100,
      currency: payment.currency,
      status: payment.status,
      customerId: payment.customer?.id,
      customerEmail: payment.customer?.email,
      created: payment.created,
      description: payment.description
    }));

    res.json({
      payments: formattedPayments,
      hasMore: payments.has_more
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// Export data
router.get('/export', requireAdmin, async (req, res) => {
  try {
    const { type = 'users' } = req.query;
    
    // In production, generate actual CSV/Excel exports
    const csvData = `Name,Email,Plan,Status,Revenue,Join Date
John Smith,john@example.com,Professional,active,599.88,2024-01-15
Sarah Johnson,sarah@example.com,Premium,active,1199.88,2024-01-10`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${type}-export.csv"`);
    res.send(csvData);
  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

module.exports = router;

