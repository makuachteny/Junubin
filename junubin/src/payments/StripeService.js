/**
 * Stripe Payment Service — JuNubin's primary payment rail.
 *
 * All Stripe API calls go through the Supabase Edge Function
 * `stripe-create-checkout` so the secret key stays server-side. The flow:
 *
 *   1. Client calls createCheckout({ productId }) -> edge function creates a
 *      Stripe Checkout Session and returns { sessionId, url }.
 *   2. Client opens the hosted Checkout in a WebView (StripeCheckout.js)
 *      or via Linking.openURL on web.
 *   3. Stripe redirects to successUrl / cancelUrl when the session resolves.
 *   4. Stripe webhook (`stripe-webhook`) verifies the signature and grants
 *      entitlements server-side (Payment row + tier/consumable update).
 *   5. Client polls the Payment table via getSessionStatus() to know when
 *      the webhook has landed and the local cache can refresh.
 */

import { Linking, Platform } from 'react-native';
import { supabase } from '../config/supabase';

const SCHEME = Platform.select({
  ios: 'junubin',
  android: 'junubin',
  default: 'junubin',
});

/**
 * Default success / cancel deep-link targets. The hosted Checkout closes
 * itself by redirecting here; the WebView wrapper detects the scheme and
 * dismisses the modal, then kicks off a status poll.
 */
const DEFAULT_SUCCESS_URL = `${SCHEME}://payment/stripe/success?session_id={CHECKOUT_SESSION_ID}`;
const DEFAULT_CANCEL_URL = `${SCHEME}://payment/stripe/cancel`;

const StripeService = {
  /**
   * Create a Stripe Checkout Session for a single product.
   *
   * @param {object} params
   * @param {string} params.productId - Internal JuNubin product id (e.g. "com.junubin.sub.plus.monthly").
   * @param {string} [params.successUrl] - URL Stripe redirects to on success. Defaults to a junubin:// deep link.
   * @param {string} [params.cancelUrl]  - URL Stripe redirects to on abort.
   * @returns {Promise<{ sessionId: string, url: string }>}
   */
  async createCheckout({ productId, successUrl, cancelUrl }) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase.functions.invoke('stripe-create-checkout', {
      body: {
        productId,
        successUrl: successUrl || DEFAULT_SUCCESS_URL,
        cancelUrl: cancelUrl || DEFAULT_CANCEL_URL,
      },
    });

    if (error) throw new Error(error.message || 'Failed to create Stripe checkout');
    if (!data?.url || !data?.sessionId) throw new Error('No checkout URL returned');

    return { sessionId: data.sessionId, url: data.url };
  },

  /**
   * Poll the Payment table for a Stripe session and return its current
   * status. The webhook upserts the row keyed by Stripe's session id
   * (`provider=stripe`, `providerRef=<session.id>`), so a `succeeded`
   * row means entitlements have been granted server-side and the
   * client cache can refresh.
   *
   * @param {string} sessionId - The Stripe Checkout Session id.
   * @returns {Promise<{ status: 'pending'|'succeeded'|'failed'|'cancelled', productId: string|null }>}
   */
  async getSessionStatus(sessionId) {
    if (!sessionId) return { status: 'pending', productId: null };
    try {
      const { data } = await supabase
        .from('Payment')
        .select('status, junubinProductId')
        .eq('provider', 'stripe')
        .eq('providerRef', sessionId)
        .maybeSingle();
      if (!data) return { status: 'pending', productId: null };
      return { status: data.status || 'pending', productId: data.junubinProductId || null };
    } catch {
      return { status: 'pending', productId: null };
    }
  },

  /**
   * Open the hosted Checkout in the system browser. Used on web and as
   * a fallback when no WebView is available. On native we prefer the
   * StripeCheckout WebView wrapper so the redirect can be intercepted.
   */
  async openCheckoutUrl(url) {
    if (!url) return false;
    const can = await Linking.canOpenURL(url);
    if (!can) return false;
    await Linking.openURL(url);
    return true;
  },

  /**
   * Create a Stripe Billing Portal session for the current user so
   * they can self-serve cancellation / plan switch / card update /
   * invoice download. Returns `{ available: false }` when the user
   * has no Stripe customer (IAP-only subscribers, free users) so the
   * caller can fall back to the App Store / Play Store URL.
   *
   * @param {object} [params]
   * @param {string} [params.returnUrl] - Deep link Stripe redirects to when the user closes the portal.
   * @returns {Promise<{ available: true, url: string } | { available: false, reason: string }>}
   */
  async openBillingPortal({ returnUrl } = {}) {
    try {
      const { data, error } = await supabase.functions.invoke('stripe-billing-portal', {
        body: { returnUrl: returnUrl || `${SCHEME}://account` },
      });
      // Edge function returns 404 when no Stripe customer exists for
      // this user — that's the IAP / free path, not an error.
      if (error?.context?.status === 404 || error?.status === 404) {
        return { available: false, reason: 'no_stripe_customer' };
      }
      if (error) {
        return { available: false, reason: error.message || 'unknown' };
      }
      if (!data?.url) {
        return { available: false, reason: 'no_portal_url' };
      }
      return { available: true, url: data.url };
    } catch (err) {
      return { available: false, reason: err?.message || 'unknown' };
    }
  },
};

export default StripeService;
