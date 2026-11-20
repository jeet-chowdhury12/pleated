// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const ZINI_API_KEY = Deno.env.get('ZINI_API_KEY') || ''
    const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || ''
    const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID') || ''
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const payload = await req.json()

    // MODE A: Frontend requests a new Zini Pay payment link
    if (payload.action === 'create_payment') {
      const { orderId, amount, customerEmail, customerName, customerPhone, redirectUrl } = payload

      if (!ZINI_API_KEY) {
        return new Response(
          JSON.stringify({
            success: true,
            paymentUrl: `${redirectUrl}?order_id=${orderId}&simulated=true`,
            simulated: true
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }

      const ziniRes = await fetch('https://api.zinipay.com/v1/payment/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'zini-api-key': ZINI_API_KEY
        },
        body: JSON.stringify({
          amount: amount,
          cus_name: customerName,
          cus_email: customerEmail,
          cus_phone: customerPhone,
          redirect_url: `${redirectUrl}?order_id=${orderId}`,
          cancel_url: `${redirectUrl}?order_cancelled=true`,
          webhook_url: `${SUPABASE_URL}/functions/v1/zinipay-webhook`,
          metadata: { order_id: orderId }
        })
      })

      const ziniData = await ziniRes.json()
      return new Response(
        JSON.stringify({
          success: true,
          paymentUrl: ziniData.payment_url || ziniData.url,
          orderId
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // MODE B: Zini Pay Webhook callback when customer completes payment
    const orderId = payload.orderId || payload.metadata?.order_id
    const transactionId = payload.transactionId || payload.trx_id || `ZINI-${Date.now()}`
    const amount = payload.amount || 0
    const status = payload.status || ''

    if (status === 'SUCCESS' || status === 'COMPLETED' || status === 'paid') {
      if (orderId) {
        await supabase.from('orders').update({ status: 'paid' }).eq('id', orderId)
      }

      await supabase.from('transactions').insert({
        order_id: orderId,
        zini_transaction_id: transactionId,
        amount: amount,
        payment_status: 'PAID',
        raw_response: payload
      })

      if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
        const message =
          `🚨 *NEW PAID ORDER — PLEATED.*\n\n` +
          `🧾 Order ID: \`${orderId}\`\n` +
          `💳 Trx ID: \`${transactionId}\`\n` +
          `💰 Amount: *৳${amount}*\n` +
          `✅ Status: *PAID via Zini Pay*`

        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: 'Markdown'
          })
        })
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})