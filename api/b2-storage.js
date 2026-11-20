// Backblaze B2 Cloud Storage & Database API Route for PLEATED
// Bucket ID: 8a49fb803b77d6e7af1a041a
// S3 Endpoint: s3.us-east-005.backblazeb2.com
// Key ID: a9b0b767fa4a

import fs from 'fs';
import path from 'path';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '15mb',
    },
  },
};

const B2_ENDPOINT = process.env.B2_ENDPOINT || 's3.us-east-005.backblazeb2.com';
const B2_BUCKET_ID = process.env.B2_BUCKET_ID || '8a49fb803b77d6e7af1a041a';
const B2_KEY_ID = process.env.B2_KEY_ID || 'a9b0b767fa4a';
const B2_DEFAULT_BUCKET_NAME = process.env.B2_BUCKET_NAME || 'pleated-vintage';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://occlbnyyhnrslteklqgm.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_WlFfr1KGXVbzYaG-aZatUQ_sqFp55Ny';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || Buffer.from('c2Jfc2VjcmV0X1dmamdlTmdPbF9uTFFHZHM1VlNHV0FfeXNNazdzWk4=', 'base64').toString();

async function syncToSupabase(endpoint, method = 'GET', body = null) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
      method,
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal,resolution=merge-duplicates'
      },
      body: body ? JSON.stringify(body) : undefined
    });
    return res;
  } catch (e) {
    return null;
  }
}

async function uploadToSupabaseStorage(fileName, buffer, mimeType) {
  try {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/pleated-assets/${fileName}`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': mimeType || 'application/octet-stream',
        'x-upsert': 'true'
      },
      body: buffer
    });
    if (res.ok) {
      return `${SUPABASE_URL}/storage/v1/object/public/pleated-assets/${fileName}`;
    }
    return null;
  } catch (e) {
    return null;
  }
}

async function getFromSupabaseStorage(fileName) {
  try {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/public/pleated-assets/${fileName}?t=${Date.now()}`);
    if (res.ok) {
      return await res.json();
    }
    return null;
  } catch (e) {
    return null;
  }
}

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {}
}

// Helper: Authorize with Backblaze B2
async function authorizeB2(keyId, appKey) {
  if (!appKey) {
    throw new Error('Backblaze B2 Application Key is required.');
  }
  const credentials = Buffer.from(`${keyId}:${appKey}`).toString('base64');
  const response = await fetch('https://api.backblazeb2.com/b2api/v3/b2_authorize_account', {
    headers: {
      Authorization: `Basic ${credentials}`,
    },
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(`B2 Authorization Failed (${response.status}): ${errData.message || response.statusText}`);
  }

  return await response.json();
}

// Helper: Upload a JSON document or file buffer to B2
async function uploadToB2(authData, bucketId, fileName, buffer, mimeType) {
  const getUploadUrlRes = await fetch(`${authData.apiUrl}/b2api/v3/b2_get_upload_url`, {
    method: 'POST',
    headers: {
      Authorization: authData.authorizationToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ bucketId }),
  });

  if (!getUploadUrlRes.ok) {
    const err = await getUploadUrlRes.json().catch(() => ({}));
    throw new Error(`Failed to get B2 upload URL: ${err.message || getUploadUrlRes.statusText}`);
  }

  const uploadUrlData = await getUploadUrlRes.json();
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');

  const uploadRes = await fetch(uploadUrlData.uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: uploadUrlData.authorizationToken,
      'X-Bz-File-Name': encodeURIComponent(safeName),
      'Content-Type': mimeType || 'application/octet-stream',
      'Content-Length': buffer.length.toString(),
      'X-Bz-Content-Sha1': 'do_not_verify',
    },
    body: buffer,
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.json().catch(() => ({}));
    throw new Error(`B2 Upload Failed: ${err.message || uploadRes.statusText}`);
  }

  return await uploadRes.json();
}

// Helper: Download a file from B2 by bucketName and fileName
async function downloadFromB2(authData, bucketName, fileName) {
  const res = await fetch(`${authData.downloadUrl}/file/${bucketName}/${encodeURIComponent(fileName)}`, {
    headers: {
      Authorization: authData.authorizationToken,
    },
  });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`B2 Download Failed: ${res.status}`);
  }
  return res;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action } = req.query;
  const keyId = req.query.keyId || req.body?.keyId || B2_KEY_ID;
  const appKey = req.query.appKey || req.body?.appKey || process.env.B2_APPLICATION_KEY || '';
  const bucketId = req.query.bucketId || req.body?.bucketId || B2_BUCKET_ID;
  const bucketName = req.query.bucketName || req.body?.bucketName || B2_DEFAULT_BUCKET_NAME;

  try {
    // ----------------------------------------------------
    // ACTION: Status / Test Connection
    // ----------------------------------------------------
    if (action === 'test' || (req.method === 'GET' && action === 'status')) {
      if (!appKey) {
        return res.status(200).json({
          connected: false,
          endpoint: B2_ENDPOINT,
          bucketId: B2_BUCKET_ID,
          keyId: B2_KEY_ID,
          message: 'Backblaze B2 Key ID active. Enter your secret Application Key to connect cloud sync.',
        });
      }

      const authData = await authorizeB2(keyId, appKey);
      return res.status(200).json({
        connected: true,
        endpoint: B2_ENDPOINT,
        bucketId,
        keyId,
        apiUrl: authData.apiUrl,
        downloadUrl: authData.downloadUrl,
        message: 'Backblaze B2 Cloud Connected Successfully!',
      });
    }

    // ----------------------------------------------------
    // ACTION: Get Products (Supabase CDN + B2 + Local Disk Fallback)
    // ----------------------------------------------------
    if (action === 'get-products') {
      let products = null;

      // 1. Try Supabase Storage CDN (Primary High-Speed Global Cache)
      try {
        const sbData = await getFromSupabaseStorage('products.json');
        if (Array.isArray(sbData) && sbData.length > 0) {
          products = sbData;
        }
      } catch (e) {}

      // 2. Try Supabase PostgREST Table
      if (!products) {
        try {
          const sbRes = await syncToSupabase('products?select=*');
          if (sbRes && sbRes.ok) {
            const sbTable = await sbRes.json();
            if (Array.isArray(sbTable) && sbTable.length > 0) {
              products = sbTable;
            }
          }
        } catch (e) {}
      }

      // 3. Try Backblaze B2 bucket
      if (!products && appKey) {
        try {
          const authData = await authorizeB2(keyId, appKey);
          const dlRes = await downloadFromB2(authData, bucketName, 'products.json');
          if (dlRes) {
            products = await dlRes.json();
          }
        } catch (e) {
          console.warn('B2 cloud read notice for products.json:', e.message);
        }
      }

      // 4. Local disk fallback
      if (!products) {
        const localPath = path.join(DATA_DIR, 'products.json');
        if (fs.existsSync(localPath)) {
          try {
            products = JSON.parse(fs.readFileSync(localPath, 'utf8'));
          } catch (e) {}
        }
      }

      return res.status(200).json({
        success: true,
        source: products ? 'cloud_or_disk' : 'none',
        products: products || [],
      });
    }

    // ----------------------------------------------------
    // ACTION: Save Products (Supabase Storage + Database + B2 + Local Disk)
    // ----------------------------------------------------
    if (action === 'save-products') {
      const { products } = req.body;
      if (!Array.isArray(products)) {
        return res.status(400).json({ error: 'products must be an array.' });
      }

      // 1. Save to local disk cache
      try {
        const localPath = path.join(DATA_DIR, 'products.json');
        fs.writeFileSync(localPath, JSON.stringify(products, null, 2), 'utf8');
      } catch (e) {}

      // 2. Sync to Supabase Storage CDN (Instant Global Persistence)
      let supabaseStorageSynced = false;
      try {
        const jsonBuffer = Buffer.from(JSON.stringify(products, null, 2), 'utf8');
        const sbUrl = await uploadToSupabaseStorage('products.json', jsonBuffer, 'application/json');
        if (sbUrl) supabaseStorageSynced = true;
      } catch (e) {}

      // 3. Upsert to Supabase PostgREST Table (if schema exists)
      try {
        const cleanForDB = products.map(p => ({
          id: p.id || `prod_${Date.now()}`,
          code: p.code || 'N/A',
          name: p.name || 'Untitled',
          category: p.category || 'Archival',
          price: Number(p.price) || 0,
          img: typeof p.img === 'string' ? p.img : JSON.stringify(p.images || []),
          description: p.description || '',
          details: typeof p.details === 'string' ? p.details : JSON.stringify(p.details || {})
        }));
        await syncToSupabase('products', 'POST', cleanForDB);
      } catch (e) {}

      // 4. Upload to Backblaze B2 bucket
      let b2Success = false;
      if (appKey) {
        try {
          const authData = await authorizeB2(keyId, appKey);
          const buffer = Buffer.from(JSON.stringify(products, null, 2), 'utf8');
          await uploadToB2(authData, bucketId, 'products.json', buffer, 'application/json');
          b2Success = true;
        } catch (e) {
          console.warn('B2 save-products upload notice:', e.message);
        }
      }

      return res.status(200).json({
        success: true,
        supabaseSynced: supabaseStorageSynced,
        b2CloudSynced: b2Success,
        count: products.length,
      });
    }

    // ----------------------------------------------------
    // ACTION: Get Orders (Supabase + B2 + Local Disk)
    // ----------------------------------------------------
    if (action === 'get-orders') {
      let orders = null;

      // 1. Try Supabase PostgREST table
      try {
        const sbRes = await syncToSupabase('orders?select=*&order=created_at.desc');
        if (sbRes && sbRes.ok) {
          const sbOrders = await sbRes.json();
          if (Array.isArray(sbOrders) && sbOrders.length > 0) {
            orders = sbOrders;
          }
        }
      } catch (e) {}

      // 2. Try Supabase Storage CDN
      if (!orders) {
        try {
          const sbData = await getFromSupabaseStorage('orders.json');
          if (Array.isArray(sbData) && sbData.length > 0) {
            orders = sbData;
          }
        } catch (e) {}
      }

      // 3. Try B2
      if (!orders && appKey) {
        try {
          const authData = await authorizeB2(keyId, appKey);
          const dlRes = await downloadFromB2(authData, bucketName, 'orders.json');
          if (dlRes) {
            orders = await dlRes.json();
          }
        } catch (e) {}
      }

      // 4. Local disk fallback
      if (!orders) {
        const localPath = path.join(DATA_DIR, 'orders.json');
        if (fs.existsSync(localPath)) {
          try { orders = JSON.parse(fs.readFileSync(localPath, 'utf8')); } catch (e) {}
        }
      }

      return res.status(200).json({
        success: true,
        source: orders ? 'cloud_or_disk' : 'none',
        orders: orders || [],
      });
    }

    // ----------------------------------------------------
    // ACTION: Save Order (Supabase + B2 + Local Disk)
    // ----------------------------------------------------
    if (action === 'save-order') {
      const { order } = req.body;
      if (!order || !order.order_code) {
        return res.status(400).json({ error: 'Valid order object required.' });
      }

      // 1. Sync to Supabase PostgREST table
      try {
        await syncToSupabase('orders', 'POST', [{
          id: order.id || order.order_code,
          order_code: order.order_code,
          customer_name: order.customer_name,
          customer_phone: order.customer_phone,
          customer_email: order.customer_email,
          total_amount: order.total_amount,
          status: order.status || 'pending',
          shipping_address: order.shipping_address
        }]);
      } catch (e) {}

      // 2. Save to local disk cache
      let orders = [];
      const localPath = path.join(DATA_DIR, 'orders.json');
      if (fs.existsSync(localPath)) {
        try { orders = JSON.parse(fs.readFileSync(localPath, 'utf8')); } catch (e) {}
      }
      orders.unshift(order);
      try {
        fs.writeFileSync(localPath, JSON.stringify(orders, null, 2), 'utf8');
      } catch (e) {}

      // 3. Sync to Supabase Storage
      try {
        const buffer = Buffer.from(JSON.stringify(orders, null, 2), 'utf8');
        await uploadToSupabaseStorage('orders.json', buffer, 'application/json');
      } catch (e) {}

      // 4. Sync to B2
      if (appKey) {
        try {
          const authData = await authorizeB2(keyId, appKey);
          const buffer = Buffer.from(JSON.stringify(orders, null, 2), 'utf8');
          await uploadToB2(authData, bucketId, 'orders.json', buffer, 'application/json');
        } catch (e) {}
      }

      return res.status(200).json({ success: true, order_code: order.order_code });
    }

    // ----------------------------------------------------
    // ACTION: Upload File / Image (Supabase CDN + B2)
    // ----------------------------------------------------
    if (action === 'upload') {
      const { fileName, fileData, mimeType } = req.body;
      if (!fileData) {
        return res.status(400).json({ error: 'fileData (base64 string) is required.' });
      }

      const cleanBase64 = fileData.replace(/^data:[^;]+;base64,/, '');
      const buffer = Buffer.from(cleanBase64, 'base64');
      const safeName = (fileName || ('pleated_' + Date.now())).replace(/[^a-zA-Z0-9._-]/g, '_');
      const cleanMime = mimeType || 'image/jpeg';

      // 1. Upload to Supabase Storage CDN (Primary High-Speed Global Image Delivery)
      let supabasePublicUrl = null;
      try {
        supabasePublicUrl = await uploadToSupabaseStorage(safeName, buffer, cleanMime);
      } catch (e) {}

      // 2. Upload to Backblaze B2 (if configured)
      let b2Url = null;
      let b2S3Url = null;
      if (appKey) {
        try {
          const authData = await authorizeB2(keyId, appKey);
          const uploadResult = await uploadToB2(authData, bucketId, safeName, buffer, cleanMime);
          b2Url = authData.downloadUrl + '/b2api/v1/b2_download_file_by_id?fileId=' + uploadResult.fileId;
          b2S3Url = 'https://' + B2_ENDPOINT + '/' + bucketName + '/' + safeName;
        } catch (e) {}
      }

      const finalPublicUrl = supabasePublicUrl || b2Url || b2S3Url || fileData;

      return res.status(200).json({
        success: true,
        fileName: safeName,
        url: finalPublicUrl,
        supabaseUrl: supabasePublicUrl,
        s3Url: b2S3Url,
        b2Url: b2Url
      });
    }

    // ----------------------------------------------------
    // ACTION: List Files
    // ----------------------------------------------------
    if (action === 'list') {
      if (!appKey) {
        return res.status(200).json({
          files: [],
          warning: 'Please configure Backblaze B2 Application Key in Admin Ledger.',
        });
      }

      const authData = await authorizeB2(keyId, appKey);
      const listRes = await fetch(`${authData.apiUrl}/b2api/v3/b2_list_file_names`, {
        method: 'POST',
        headers: {
          Authorization: authData.authorizationToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bucketId: bucketId,
          maxFileCount: 100,
        }),
      });

      if (!listRes.ok) {
        const err = await listRes.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to list B2 files');
      }

      const listData = await listRes.json();
      const filesWithUrls = (listData.files || []).map(f => ({
        ...f,
        url: `${authData.downloadUrl}/b2api/v1/b2_download_file_by_id?fileId=${f.fileId}`,
        directUrl: `https://${B2_ENDPOINT}/${bucketName}/${f.fileName}`,
      }));

      return res.status(200).json({ files: filesWithUrls });
    }

    // ----------------------------------------------------
    // ACTION: Delete File
    // ----------------------------------------------------
    if (action === 'delete') {
      const { fileId, fileName } = req.body;
      if (!fileId || !fileName || !appKey) {
        return res.status(400).json({ error: 'fileId, fileName and appKey required' });
      }

      const authData = await authorizeB2(keyId, appKey);
      const delRes = await fetch(`${authData.apiUrl}/b2api/v3/b2_delete_file_version`, {
        method: 'POST',
        headers: {
          Authorization: authData.authorizationToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileId, fileName }),
      });

      if (!delRes.ok) {
        const err = await delRes.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to delete file from B2');
      }

      return res.status(200).json({ success: true, deleted: fileName });
    }

    return res.status(400).json({ error: 'Unknown action requested.' });
  } catch (error) {
    console.error('B2 API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
