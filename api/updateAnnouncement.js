export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-pass');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  const adminPass = req.headers['x-admin-pass'];
  if (adminPass !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const { announcement } = req.body || {};
  if (!announcement || typeof announcement !== 'string') {
    return res.status(400).json({ error: 'Missing announcement text' });
  }
  
  const token = process.env.GITHUB_TOKEN;
  const gistId = process.env.GIST_ID; // Add this to your env variables
  const fileName = process.env.FILE_PATH || 'anc.txt';
  
  try {
    // Update Gist
    const gistUrl = `https://api.github.com/gists/${gistId}`;
    const putRes = await fetch(gistUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify({
        files: {
          [fileName]: {
            content: announcement
          }
        }
      })
    });
    
    if (!putRes.ok) {
      const txt = await putRes.text();
      console.error('GitHub Gist error:', txt);
      return res.status(500).json({ error: 'Failed to update Gist' });
    }
    
    // Discord webhook
    const discordWebhook = process.env.DISCORD_WEBHOOK_URL;
    if (discordWebhook) {
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
    }
    
    res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
```

**Steps to set up with Gist:**

1. **Create a Gist:**
   - Go to https://gist.github.com
   - Create a new Gist with filename `anc.txt`
   - Add some initial content
   - Save it (can be public or secret)

2. **Get the Gist ID:**
   - From the URL: `https://gist.github.com/yourusername/ABC123DEF456`
   - The ID is `ABC123DEF456`

3. **Add to Vercel Environment Variables:**
   - `GIST_ID` = your gist ID (like `ABC123DEF456`)
   - Keep your existing `GITHUB_TOKEN`, `ADMIN_PASSWORD`, etc.
   - You can remove `REPO_NAME`, `REPO_OWNER` if you're only using Gist

4. **Benefits of using Gist:**
   - Simpler API (no need to fetch SHA)
   - Direct public URL to raw file
   - Less permissions needed
   - Faster updates

**To read the announcement from Gist:**
```
https://gist.githubusercontent.com/yourusername/GIST_ID/raw/anc.txt
