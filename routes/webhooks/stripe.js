const express = require('express');
const Stripe = require('stripe');
const router = express.Router();

// Initialize Stripe with secret key
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Stripe webhook endpoint
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    console.log(`✅ Webhook signature verified: ${event.type}`);
  } catch (err) {
    console.error(`❌ Webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object);
        break;
      
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object);
        break;
      
      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object);
        break;
      
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;
      
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object);
        break;
      
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
        break;
      
      default:
        console.log(`🔔 Unhandled event type: ${event.type}`);
    }

    res.status(200).json({ received: true });

  } catch (error) {
    console.error(`❌ Error handling webhook event ${event.type}:`, error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

// Handle successful checkout session completion
async function handleCheckoutSessionCompleted(session) {
  console.log(`💰 Checkout session completed: ${session.id}`);
  console.log(`📧 Customer email: ${session.customer_email}`);
  console.log(`💵 Amount: ${session.amount_total} ${session.currency}`);
  console.log(`📋 Metadata:`, session.metadata);

  // TODO: Update your database with payment information
  // Example:
  // - Create or update user subscription
  // - Send confirmation email
  // - Update user permissions
  // - Log payment in audit trail

  try {
    // Placeholder for database operations
    const paymentRecord = {
      sessionId: session.id,
      customerEmail: session.customer_email,
      amount: session.amount_total,
      currency: session.currency,
      status: 'completed',
      metadata: session.metadata,
      timestamp: new Date().toISOString()
    };

    console.log(`📝 Payment record created:`, paymentRecord);

    // Here you would typically:
    // 1. Save payment to database
    // 2. Update user subscription status
    // 3. Send confirmation email
    // 4. Trigger any post-payment workflows

  } catch (error) {
    console.error('❌ Error processing checkout completion:', error);
    throw error;
  }
}

// Handle successful payment intent
async function handlePaymentIntentSucceeded(paymentIntent) {
  console.log(`✅ Payment intent succeeded: ${paymentIntent.id}`);
  console.log(`💵 Amount: ${paymentIntent.amount} ${paymentIntent.currency}`);

  // TODO: Update payment status in your database
}

// Handle failed payment intent
async function handlePaymentIntentFailed(paymentIntent) {
  console.log(`❌ Payment intent failed: ${paymentIntent.id}`);
  console.log(`💵 Amount: ${paymentIntent.amount} ${paymentIntent.currency}`);
  console.log(`🚫 Failure reason: ${paymentIntent.last_payment_error?.message}`);

  // TODO: Handle payment failure
  // - Notify user of failed payment
  // - Update subscription status
  // - Trigger retry logic if applicable
}

// Handle subscription creation
async function handleSubscriptionCreated(subscription) {
  console.log(`🆕 Subscription created: ${subscription.id}`);
  console.log(`👤 Customer: ${subscription.customer}`);
  console.log(`📅 Status: ${subscription.status}`);

  // TODO: Update user subscription in database
}

// Handle subscription updates
async function handleSubscriptionUpdated(subscription) {
  console.log(`🔄 Subscription updated: ${subscription.id}`);
  console.log(`📅 Status: ${subscription.status}`);

  // TODO: Update subscription status in database
}

// Handle subscription deletion
async function handleSubscriptionDeleted(subscription) {
  console.log(`🗑️ Subscription deleted: ${subscription.id}`);
  console.log(`👤 Customer: ${subscription.customer}`);

  // TODO: Handle subscription cancellation
  // - Update user permissions
  // - Send cancellation confirmation
  // - Archive subscription data
}

// Handle successful invoice payment
async function handleInvoicePaymentSucceeded(invoice) {
  console.log(`💳 Invoice payment succeeded: ${invoice.id}`);
  console.log(`💵 Amount: ${invoice.amount_paid} ${invoice.currency}`);

  // TODO: Update payment records
}

// Handle failed invoice payment
async function handleInvoicePaymentFailed(invoice) {
  console.log(`💳 Invoice payment failed: ${invoice.id}`);
  console.log(`💵 Amount: ${invoice.amount_due} ${invoice.currency}`);

  // TODO: Handle failed recurring payment
  // - Notify user
  // - Update subscription status
  // - Implement dunning management
}

module.exports = router;

