export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-pass');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  try {
    const adminPass = req.headers['x-admin-pass'];
    console.log('Admin pass check:', adminPass ? 'provided' : 'missing');
    console.log('Expected pass:', process.env.ADMIN_PASSWORD ? 'set' : 'not set');
    
    if (adminPass !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const { announcement } = req.body || {};
    if (!announcement || typeof announcement !== 'string') {
      return res.status(400).json({ error: 'Missing announcement text' });
    }
    
    const token = process.env.GITHUB_TOKEN;
    const gistId = process.env.GIST_ID;
    const fileName = process.env.FILE_PATH || 'anc.txt';
    
    console.log('Env check:', {
      tokenSet: token ? 'yes' : 'NO',
      gistIdSet: gistId ? 'yes' : 'NO',
      fileName
    });
    
    if (!token) {
      return res.status(500).json({ error: 'GITHUB_TOKEN not configured' });
    }
    
    if (!gistId) {
      return res.status(500).json({ error: 'GIST_ID not configured' });
    }
    
    // Update Gist
    const gistUrl = `https://api.github.com/gists/${gistId}`;
    console.log('Updating gist:', gistUrl);
    
    const putRes = await fetch(gistUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Hermano-Announcer'
      },
      body: JSON.stringify({
        files: {
          [fileName]: {
            content: announcement
          }
        }
      })
    });
    
    console.log('GitHub response status:', putRes.status);
    
    if (!putRes.ok) {
      const errorText = await putRes.text();
      console.error('GitHub Gist error:', errorText);
      return res.status(500).json({ 
        error: 'Failed to update Gist',
        details: errorText.substring(0, 200)
      });
    }
    
    // Discord webhook (optional)
    const discordWebhook = process.env.DISCORD_WEBHOOK_URL;
    if (discordWebhook) {
      try {
        await fetch(discordWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: '@everyone',
            embeds: [{
              title: '📢 NEW ANNOUNCEMENT',
              description: announcement,
              color: 0xFFD700,
              timestamp: new Date().toISOString()
            }]
          })
        });
      } catch (discordError) {
        console.error('Discord webhook failed:', discordError);
        // Don't fail the whole request if Discord fails
      }
    }
    
    return res.status(200).json({ success: true });
    
  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ 
      error: 'Server error', 
      message: err.message 
    });
  }
}
