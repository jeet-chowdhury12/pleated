export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { amount, order_code, customer_name, customer_email, customer_phone } = req.body;
    const apiKey = "b01b1da82bd34e355e36f0421b5b3b72639fdc1bf18a7491";

    const strictEmailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const cleanPhone = (customer_phone || '').trim().replace(/[^\d+]/g, '');
    const cleanEmail = (customer_email && strictEmailRegex.test(customer_email.trim()) && !customer_email.includes('..')) 
      ? customer_email.trim() 
      : `order.${(order_code || 'ord').toLowerCase().replace(/[^a-z0-9]/g, '')}@pleated.store`;

    const cleanAmount = Math.max(1, Math.round(Number(amount) || 0));
    const cleanName = (customer_name || 'Valued Customer').trim().substring(0, 80);

    const response = await fetch("https://api.zinipay.com/v1/payment/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "zini-api-key": apiKey
      },
      body: JSON.stringify({
        amount: cleanAmount,
        order_code: order_code,
        redirect_url: `https://pleated.store/?payment=success&order=${order_code}`,
        cancel_url: `https://pleated.store/?payment=cancel&order=${order_code}`,
        cus_name: cleanName,
        cus_email: cleanEmail,
        cus_phone: cleanPhone.length >= 7 ? cleanPhone : ((customer_phone && customer_phone.trim()) || '01700000000'),
        metadata: { order_code: order_code }
      })
    });

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}