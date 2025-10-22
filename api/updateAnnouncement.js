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
  const owner = process.env.REPO_OWNER;
  const repo = process.env.REPO_NAME;
  const path = process.env.FILE_PATH || 'anc.txt';

  try {
    const getUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
    const getRes = await fetch(getUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    let sha = null;
    if (getRes.status === 200) {
      const data = await getRes.json();
      sha = data.sha;
    }

    const contentBase64 = Buffer.from(announcement, 'utf8').toString('base64');
    const putRes = await fetch(getUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify({
        message: `Update announcement via uploader (${new Date().toISOString()})`,
        content: contentBase64,
        sha
      })
    });

    if (!putRes.ok) {
      const txt = await putRes.text();
      console.error('GitHub error:', txt);
      return res.status(500).json({ error: 'Failed to update GitHub file' });
    }

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
