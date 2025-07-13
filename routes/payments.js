const express = require('express');
const Stripe = require('stripe');
const router = express.Router();

// Initialize Stripe with secret key
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Create checkout session endpoint
router.post('/create-checkout-session', async (req, res) => {
  try {
    const { amount, currency, email, landlordId, metadata = {} } = req.body;

    // Validate required fields
    if (!amount || !currency || !email) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['amount', 'currency', 'email']
      });
    }

    // Validate amount (must be positive integer)
    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({
        error: 'Amount must be a positive number'
      });
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: 'Rent Control Subscription',
              description: `${metadata.plan || 'Professional'} Plan - ${metadata.billingCycle || 'monthly'} billing`,
              metadata: { 
                landlordId: landlordId || 'unknown',
                plan: metadata.plan || 'professional',
                billingCycle: metadata.billingCycle || 'monthly'
              }
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      metadata: {
        ...metadata,
        landlordId: landlordId || 'unknown',
        email,
        timestamp: new Date().toISOString()
      },
      success_url: `${process.env.CLIENT_URL}/payment-processing?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/payment-processing?canceled=true`,
      billing_address_collection: 'auto',
      shipping_address_collection: {
        allowed_countries: ['US', 'CA', 'GB', 'AU', 'DE', 'FR', 'ES', 'IT', 'NL', 'SE', 'NO', 'DK', 'FI']
      }
    });

    console.log(`✅ Created checkout session: ${session.id} for ${email}`);

    res.json({ 
      url: session.url,
      sessionId: session.id
    });

  } catch (error) {
    console.error('❌ Checkout session creation error:', error);
    res.status(500).json({ 
      error: 'Failed to create checkout session',
      message: error.message 
    });
  }
});

// Verify payment endpoint
router.get('/verify-payment', async (req, res) => {
  try {
    const { session_id } = req.query;

    if (!session_id) {
      return res.status(400).json({
        error: 'Missing session_id parameter'
      });
    }

    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(session_id);

    console.log(`🔍 Verifying payment for session: ${session_id}`);

    if (session.payment_status === 'paid') {
      res.json({
        status: 'success',
        sessionId: session.id,
        customerEmail: session.customer_email,
        amountTotal: session.amount_total,
        currency: session.currency,
        metadata: session.metadata
      });
    } else {
      res.json({
        status: 'pending',
        sessionId: session.id,
        paymentStatus: session.payment_status
      });
    }

  } catch (error) {
    console.error('❌ Payment verification error:', error);
    res.status(500).json({
      error: 'Failed to verify payment',
      message: error.message
    });
  }
});

// Get payment history (placeholder for future implementation)
router.get('/payment-history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // This would typically query your database for payment history
    // For now, return a placeholder response
    res.json({
      userId,
      payments: [],
      message: 'Payment history feature coming soon'
    });

  } catch (error) {
    console.error('❌ Payment history error:', error);
    res.status(500).json({
      error: 'Failed to retrieve payment history',
      message: error.message
    });
  }
});

module.exports = router;

