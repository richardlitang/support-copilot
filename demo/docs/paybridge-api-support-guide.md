# PayBridge API Support Guide

Demo corpus for Support Copilot. This is fictional documentation created for testing retrieval, citations, customer-safe replies, and weak-evidence fallbacks. It is not production payment advice and is not copied from any vendor documentation.

## Overview

PayBridge is a fictional payment API. The API returns structured errors with `code`, `message`, `request_id`, and sometimes `decline_code`, `payment_id`, `invoice_id`, or `event_id`. A support answer should cite the relevant code entry and should not invent details that are missing from the ticket.

## Support workflow

Use this workflow before writing a customer reply.

### Information to collect

Ask for these fields when they are missing:

- request_id or event_id
- account_id or workspace ID
- environment: test, staging, or live
- timestamp and timezone
- error code and message
- affected object ID: payment_id, invoice_id, customer_id, subscription_id, or payout_id
- whether the failure started after a deployment, key rotation, dashboard setting change, DNS change, or webhook endpoint change

### Customer-safe vs internal-only information

Customer-safe information:

- the visible error code
- the likely integration cause
- the next action the merchant can take
- whether the issue is caused by missing authentication, wrong mode, invalid amount, insufficient funds, or disabled endpoint

Internal-only information:

- fraud/risk scores
- secret keys or full tokens
- internal traces from third-party providers
- personal identity document details
- raw card data, CVC, or full bank account numbers

### Weak evidence rule

If the ticket lacks a request_id, event_id, error code, and timestamp, the answer must be framed as a diagnostic checklist instead of a definitive root cause. The first response should ask for missing evidence and give only the most likely checks.

### Escalation rule

Escalate to engineering only after support has verified:

1. The exact error code.
2. The affected environment.
3. A recent request_id or event_id.
4. Whether the documented customer action has already been tried.
5. Whether the issue reproduces across more than one account, customer, card, or endpoint.

## Error code reference

Each entry includes customer-facing action, support investigation steps, and escalation guidance.

### `api_key_expired`

**Meaning:** The secret API key used by the integration has expired or was rotated.

**Likely causes:**
- Deployed service still uses an old environment variable
- Live key was rotated without redeploying workers
- Using a key copied from the wrong workspace

**Customer action:** Ask the workspace admin to copy the current secret key, update the production secret store, and redeploy the service. Never send the key in a support ticket.

**Support action:** Request the request_id, deployment environment, and last deployment time. Confirm whether failures started immediately after a key rotation.

**Escalation rule:** Only escalate if the current key also fails from the dashboard test console.

### `authentication_required`

**Meaning:** The payment requires the customer to complete an authentication step before it can succeed.

**Likely causes:**
- 3D Secure or bank challenge is required
- Off-session payment attempted without prior mandate
- Customer abandoned the authentication redirect

**Customer action:** Return the customer to the hosted confirmation page or ask them to retry with a payment method that can complete authentication.

**Support action:** Check whether the PaymentIntent status is requires_action and whether next_action.redirect_url exists.

**Escalation rule:** Escalate if the next_action value is missing for multiple recent requests with different cards.

### `card_declined`

**Meaning:** The issuing bank declined the card. The API response should include a more specific decline_code.

**Likely causes:**
- Issuer refused authorization
- Risk controls blocked the attempt
- Cardholder bank requires another payment method

**Customer action:** Ask the buyer to contact their bank or use a different card. Do not retry the same card repeatedly.

**Support action:** Locate the decline_code and share only customer-safe guidance. Do not reveal internal risk scoring.

**Escalation rule:** Escalate only if multiple unrelated cards decline for the same merchant within a short window.

### `expired_card`

**Meaning:** The card expiration date is in the past.

**Likely causes:**
- Customer selected an old saved card
- Card metadata was not refreshed after a card update

**Customer action:** Ask the buyer to update the card expiration date or choose another saved payment method.

**Support action:** Check whether the same customer has a newer saved card on file.

**Escalation rule:** Do not escalate unless a valid future expiry date is rejected repeatedly.

### `incorrect_cvc`

**Meaning:** The CVC value failed validation or did not match issuer records.

**Likely causes:**
- Customer typed the wrong CVC
- Saved card was reused for a flow that requires CVC recollection

**Customer action:** Ask the buyer to re-enter the security code or use a different card.

**Support action:** Do not ask the buyer to send the CVC to support. Confirm that the checkout page recollects CVC when required.

**Escalation rule:** Escalate if CVC recollection is enabled but the API never receives a cvc_check result.

### `insufficient_funds`

**Meaning:** The account or card does not have enough available funds for the attempted amount.

**Likely causes:**
- Buyer account balance is too low
- Issuer applied a spending limit
- Currency conversion changed the final amount

**Customer action:** Ask the buyer to use another payment method or contact their bank.

**Support action:** Confirm the amount and currency. Do not suggest force-retrying the same payment.

**Escalation rule:** Do not escalate unless the merchant can show successful authorization for the same amount with the same issuer immediately before failure.

### `invalid_amount`

**Meaning:** The amount is invalid for the currency or payment method.

**Likely causes:**
- Amount is zero or negative
- Amount is not in the smallest currency unit
- Amount exceeds payment method maximum

**Customer action:** Send a positive integer amount in the smallest currency unit. For example, EUR 12.34 should be 1234.

**Support action:** Check the raw request payload and currency. Look for decimal strings such as 12.34 instead of 1234.

**Escalation rule:** Escalate if the payload is valid and the error persists across currencies.

### `livemode_mismatch`

**Meaning:** A test-mode object is being used with a live key, or a live object is being used with a test key.

**Likely causes:**
- Frontend uses test publishable key while backend uses live secret key
- Stored customer_id was created in test mode
- Webhook handler receives events from the wrong endpoint

**Customer action:** Use test keys with test objects and live keys with live objects. Recreate the customer or payment method in the correct mode.

**Support action:** Ask for the first 8 characters of object IDs and the environment name, never the full secret key.

**Escalation rule:** Escalate if dashboard mode labels do not match object prefixes or environment logs.

### `idempotency_key_in_use`

**Meaning:** Two concurrent requests are using the same idempotency key before the first request has completed.

**Likely causes:**
- Client double-submits the checkout form
- Retry worker starts before the original request finishes
- Shared idempotency key reused across unrelated operations

**Customer action:** Serialize requests for the same operation and reuse the key only for a true retry of the exact same request body.

**Support action:** Compare request_id timestamps and request bodies. Confirm whether duplicate requests started within the same second.

**Escalation rule:** Escalate if the key is locked for more than 10 minutes after all related requests have completed.

### `duplicate_payment_attempt`

**Meaning:** The platform detected a second payment attempt for an order that already has a successful payment.

**Likely causes:**
- Webhook delivery was delayed and the merchant retried manually
- Checkout page did not disable the pay button after submit
- Order status update failed after payment success

**Customer action:** Do not create another payment for the same order. Reconcile the order using the existing successful payment_id.

**Support action:** Find the successful payment for the order_id and advise the merchant to mark the order as paid.

**Escalation rule:** Escalate if no successful payment exists but the duplicate detector blocks new attempts.

### `object_locked`

**Meaning:** The object is temporarily locked by another process, such as capture, refund, invoice finalization, or webhook reconciliation.

**Likely causes:**
- Concurrent update to the same payment
- Refund and capture attempted at the same time
- High retry rate from a worker

**Customer action:** Retry after a short backoff. If the same object locks frequently, serialize operations against that object.

**Support action:** Look for concurrent requests against the same payment_id or invoice_id.

**Escalation rule:** Escalate if the lock lasts longer than 15 minutes without active requests.

### `rate_limit_exceeded`

**Meaning:** The integration is sending too many requests in a short period.

**Likely causes:**
- Retry loop without exponential backoff
- Bulk import script sending parallel requests
- Webhook handler calls the API once per line item

**Customer action:** Apply exponential backoff with jitter and reduce concurrency. Do not immediately retry every failed request.

**Support action:** Ask for request volume, retry policy, and whether a batch job started recently.

**Escalation rule:** Escalate quota increase requests only after the integration uses backoff and batching.

### `webhook_signature_failed`

**Meaning:** The webhook signature cannot be verified against the endpoint secret.

**Likely causes:**
- Wrong endpoint secret
- Raw body is modified before verification
- Clock skew exceeds tolerance
- Using the live secret for a test endpoint

**Customer action:** Verify the signature using the exact raw request body and the endpoint secret for that specific webhook endpoint.

**Support action:** Ask for endpoint ID, mode, framework, and whether middleware parses JSON before verification.

**Escalation rule:** Escalate if the dashboard replay fails signature verification using a newly generated secret.

### `webhook_endpoint_disabled`

**Meaning:** The endpoint was disabled after repeated delivery failures.

**Likely causes:**
- Endpoint returned 5xx errors
- TLS certificate expired
- Endpoint timed out
- DNS no longer resolves

**Customer action:** Fix the endpoint, return a 2xx response quickly, and re-enable the endpoint in the dashboard.

**Support action:** Review recent delivery attempts and response codes. Ask whether a deployment or DNS change happened.

**Escalation rule:** Escalate only if dashboard delivery logs show 2xx responses but the endpoint remains disabled.

### `invoice_no_payment_method`

**Meaning:** The invoice cannot be finalized or paid because no usable payment method is available.

**Likely causes:**
- Customer has no default payment method
- Invoice payment settings restrict allowed methods
- Payment method was detached after subscription creation

**Customer action:** Attach a valid payment method to the customer or update the invoice payment settings.

**Support action:** Check customer.default_payment_method, subscription.default_payment_method, and invoice.payment_settings.

**Escalation rule:** Escalate if the invoice shows a valid method but the API still reports none.

### `invoice_payment_requires_action`

**Meaning:** The invoice payment created a payment that requires customer authentication.

**Likely causes:**
- Saved card requires 3D Secure
- Mandate was not collected on-session
- Customer is off-session and bank requires challenge

**Customer action:** Send the hosted invoice payment link or customer portal link so the customer can authenticate.

**Support action:** Check whether the invoice has a hosted_invoice_url and whether email notifications are enabled.

**Escalation rule:** Escalate if the hosted link is missing for finalized invoices that require action.

### `refund_already_processed`

**Meaning:** The requested refund has already been completed or an identical refund request already succeeded.

**Likely causes:**
- Support clicked refund twice
- Retry worker did not persist the first result
- Merchant used the same idempotency key and then changed the amount

**Customer action:** Do not retry the refund. Confirm refund status from the refund_id and notify the buyer if complete.

**Support action:** Find the refund_id and settlement status. Compare amount, currency, and payment_id.

**Escalation rule:** Escalate if the buyer has not received funds after the published bank settlement window.

### `payout_balance_insufficient`

**Meaning:** The account does not have enough available balance to create the payout.

**Likely causes:**
- Funds are pending and not yet available
- Reserve or negative balance reduced available amount
- Payout amount includes currency not available on account

**Customer action:** Lower the payout amount or wait until pending funds become available.

**Support action:** Check available balance by currency and pending balance by currency.

**Escalation rule:** Escalate if the dashboard shows available balance but API payout creation still fails.

### `account_verification_required`

**Meaning:** The connected account must provide required verification information before payments or payouts can continue.

**Likely causes:**
- KYC fields are missing
- Identity document review failed
- Business profile is incomplete

**Customer action:** Direct the account owner to the onboarding link and ask them to complete all required fields.

**Support action:** Check currently_due and past_due fields. Do not collect identity documents by email.

**Escalation rule:** Escalate if the account owner submitted documents more than 3 business days ago and status has not changed.

### `account_country_mismatch`

**Meaning:** The account country does not match the country of the business, bank account, or requested capability.

**Likely causes:**
- Merchant registered in one country but bank account is in another
- Wrong country selected during onboarding
- Capability not available in the selected country

**Customer action:** Create or update the account using the legal business country and a supported bank account for that country.

**Support action:** Confirm country values across account, external_account, business_profile, and capability request.

**Escalation rule:** Escalate if the country is correct and capability documentation says it is supported.

## Webhook troubleshooting

### Signature verification
- Read the endpoint secret from the dashboard for the exact endpoint and mode.
- Verify against the raw request body before JSON parsing or body mutation.
- Reject requests when the timestamp is outside the configured tolerance.
- Log the event ID and request ID, but never log the endpoint secret.

### Delivery behavior
- Return a 2xx response as soon as the event is safely queued.
- Process expensive work asynchronously after acknowledgement.
- Expect duplicate event deliveries and make handlers idempotent.
- Use the event ID as the dedupe key, not the order ID alone.

### Common failure patterns
- 404 after deployment usually means the route path changed.
- 401 or 403 usually means an application auth middleware is blocking the payment provider.
- 5xx usually means the endpoint crashed or a dependency failed.
- Timeout usually means the handler waited for slow downstream work before returning 2xx.

## Billing and invoice troubleshooting

### Invoice finalization checklist
- Confirm the invoice has at least one invoice item or subscription line item.
- Confirm the customer has a usable default payment method or the invoice allows manual payment.
- Check invoice.payment_settings if some payment method types are unexpectedly unavailable.
- Check whether tax location requirements are blocking finalization.

### Subscription payment recovery
- When an invoice payment requires action, send the hosted invoice link or customer portal link.
- If a payment method was detached, attach a new method and retry the invoice payment.
- If a coupon expired, remove it or replace it with an active coupon before retrying.
- Do not create a duplicate subscription to fix a failed invoice.

### Refund support
- Refunds should be created against the payment or charge that actually succeeded.
- Use idempotency keys for refund retry flows to avoid duplicate refunds.
- If a charge is disputed, follow the dispute workflow instead of refunding blindly.
- Tell customers that bank settlement can take several business days depending on payment method.

## Good answer pattern

For each ticket, Support Copilot should return two sections:

1. Customer reply - concise, safe, and action-oriented.
2. Internal diagnosis - evidence used, fields to inspect, escalation conditions, and missing data.
