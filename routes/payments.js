const express = require('express');
const Stripe = require('stripe');
const router = express.Router();

// Initialize Stripe with secret key
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Create subscription checkout session endpoint
router.post('/create-subscription-session', async (req, res) => {
  try {
    const { 
      priceId, 
      email, 
      customerId, 
      trialDays = 14, 
      promoCode,
      metadata = {},
      successUrl,
      cancelUrl 
    } = req.body;

    // Validate required fields
    if (!priceId || !email) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['priceId', 'email']
      });
    }

    let customer;
    
    // Create or retrieve customer
    if (customerId) {
      try {
        customer = await stripe.customers.retrieve(customerId);
      } catch (error) {
        // Customer doesn't exist, create new one
        customer = await stripe.customers.create({
          email: email,
          metadata: metadata
        });
      }
    } else {
      // Check if customer already exists
      const existingCustomers = await stripe.customers.list({
        email: email,
        limit: 1
      });
      
      if (existingCustomers.data.length > 0) {
        customer = existingCustomers.data[0];
      } else {
        customer = await stripe.customers.create({
          email: email,
          metadata: metadata
        });
      }
    }

    // Prepare session configuration
    const sessionConfig = {
      payment_method_types: ['card'],
      mode: 'subscription',
      customer: customer.id,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl || `${process.env.FRONTEND_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${process.env.FRONTEND_URL}/pricing`,
      metadata: {
        ...metadata,
        customerId: customer.id
      },
      subscription_data: {
        metadata: metadata
      }
    };

    // Add trial period if specified
    if (trialDays > 0) {
      sessionConfig.subscription_data.trial_period_days = trialDays;
    }

    // Add promo code if provided
    if (promoCode) {
      try {
        const promotionCodes = await stripe.promotionCodes.list({
          code: promoCode,
          active: true,
          limit: 1
        });
        
        if (promotionCodes.data.length > 0) {
          sessionConfig.discounts = [{
            promotion_code: promotionCodes.data[0].id
          }];
        }
      } catch (error) {
        console.warn('Invalid promo code:', promoCode);
      }
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create(sessionConfig);

    res.json({
      sessionId: session.id,
      url: session.url,
      customerId: customer.id
    });

  } catch (error) {
    console.error('Error creating subscription session:', error);
    res.status(500).json({
      error: 'Failed to create checkout session',
      message: error.message
    });
  }
});

// Create one-time payment session endpoint
router.post('/create-payment-session', async (req, res) => {
  try {
    const { 
      amount, 
      currency, 
      email, 
      description,
      metadata = {},
      successUrl,
      cancelUrl 
    } = req.body;

    // Validate required fields
    if (!amount || !currency || !email) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['amount', 'currency', 'email']
      });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: description || 'Rent Payment',
              metadata: metadata
            },
            unit_amount: Math.round(amount * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      success_url: successUrl || `${process.env.FRONTEND_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${process.env.FRONTEND_URL}/tenant-portal`,
      metadata: metadata
    });

    res.json({
      sessionId: session.id,
      url: session.url
    });

  } catch (error) {
    console.error('Error creating payment session:', error);
    res.status(500).json({
      error: 'Failed to create payment session',
      message: error.message
    });
  }
});

// Get subscription details
router.get('/subscription/:subscriptionId', async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['latest_invoice', 'customer', 'items.data.price.product']
    });

    res.json({
      subscription: {
        id: subscription.id,
        status: subscription.status,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        trial_end: subscription.trial_end,
        cancel_at_period_end: subscription.cancel_at_period_end,
        customer: subscription.customer,
        plan: subscription.items.data[0]?.price,
        latest_invoice: subscription.latest_invoice
      }
    });

  } catch (error) {
    console.error('Error retrieving subscription:', error);
    res.status(500).json({
      error: 'Failed to retrieve subscription',
      message: error.message
    });
  }
});

// Cancel subscription
router.post('/cancel-subscription', async (req, res) => {
  try {
    const { subscriptionId, cancelAtPeriodEnd = true } = req.body;

    if (!subscriptionId) {
      return res.status(400).json({
        error: 'Missing subscription ID'
      });
    }

    let subscription;
    
    if (cancelAtPeriodEnd) {
      // Cancel at period end (recommended)
      subscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true
      });
    } else {
      // Cancel immediately
      subscription = await stripe.subscriptions.cancel(subscriptionId);
    }

    res.json({
      subscription: {
        id: subscription.id,
        status: subscription.status,
        cancel_at_period_end: subscription.cancel_at_period_end,
        canceled_at: subscription.canceled_at
      }
    });

  } catch (error) {
    console.error('Error canceling subscription:', error);
    res.status(500).json({
      error: 'Failed to cancel subscription',
      message: error.message
    });
  }
});

// Create refund
router.post('/create-refund', async (req, res) => {
  try {
    const { paymentIntentId, amount, reason = 'requested_by_customer' } = req.body;

    if (!paymentIntentId) {
      return res.status(400).json({
        error: 'Missing payment intent ID'
      });
    }

    const refundData = {
      payment_intent: paymentIntentId,
      reason: reason
    };

    // Add amount if partial refund
    if (amount) {
      refundData.amount = Math.round(amount * 100); // Convert to cents
    }

    const refund = await stripe.refunds.create(refundData);

    res.json({
      refund: {
        id: refund.id,
        amount: refund.amount / 100, // Convert back to dollars
        status: refund.status,
        reason: refund.reason
      }
    });

  } catch (error) {
    console.error('Error creating refund:', error);
    res.status(500).json({
      error: 'Failed to create refund',
      message: error.message
    });
  }
});

// Get customer subscriptions
router.get('/customer/:customerId/subscriptions', async (req, res) => {
  try {
    const { customerId } = req.params;
    
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      expand: ['data.items.data.price.product']
    });

    res.json({
      subscriptions: subscriptions.data.map(sub => ({
        id: sub.id,
        status: sub.status,
        current_period_start: sub.current_period_start,
        current_period_end: sub.current_period_end,
        trial_end: sub.trial_end,
        cancel_at_period_end: sub.cancel_at_period_end,
        plan: sub.items.data[0]?.price
      }))
    });

  } catch (error) {
    console.error('Error retrieving customer subscriptions:', error);
    res.status(500).json({
      error: 'Failed to retrieve subscriptions',
      message: error.message
    });
  }
});

// Create promo code
router.post('/create-promo-code', async (req, res) => {
  try {
    const { 
      code, 
      couponId, 
      percentOff, 
      amountOff, 
      currency = 'usd',
      duration = 'once',
      maxRedemptions,
      expiresAt 
    } = req.body;

    if (!code) {
      return res.status(400).json({
        error: 'Missing promo code'
      });
    }

    let coupon;
    
    if (couponId) {
      coupon = await stripe.coupons.retrieve(couponId);
    } else {
      // Create new coupon
      const couponData = {
        duration: duration
      };

      if (percentOff) {
        couponData.percent_off = percentOff;
      } else if (amountOff) {
        couponData.amount_off = Math.round(amountOff * 100);
        couponData.currency = currency;
      } else {
        return res.status(400).json({
          error: 'Must specify either percentOff or amountOff'
        });
      }

      if (maxRedemptions) {
        couponData.max_redemptions = maxRedemptions;
      }

      coupon = await stripe.coupons.create(couponData);
    }

    // Create promotion code
    const promoCodeData = {
      coupon: coupon.id,
      code: code
    };

    if (maxRedemptions) {
      promoCodeData.max_redemptions = maxRedemptions;
    }

    if (expiresAt) {
      promoCodeData.expires_at = Math.floor(new Date(expiresAt).getTime() / 1000);
    }

    const promotionCode = await stripe.promotionCodes.create(promoCodeData);

    res.json({
      promotionCode: {
        id: promotionCode.id,
        code: promotionCode.code,
        active: promotionCode.active,
        coupon: coupon
      }
    });

  } catch (error) {
    console.error('Error creating promo code:', error);
    res.status(500).json({
      error: 'Failed to create promo code',
      message: error.message
    });
  }
});

// Get payment session details
router.get('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items', 'customer', 'subscription']
    });

    res.json({
      session: {
        id: session.id,
        payment_status: session.payment_status,
        customer: session.customer,
        subscription: session.subscription,
        amount_total: session.amount_total,
        currency: session.currency,
        metadata: session.metadata
      }
    });

  } catch (error) {
    console.error('Error retrieving session:', error);
    res.status(500).json({
      error: 'Failed to retrieve session',
      message: error.message
    });
  }
});

module.exports = router;

