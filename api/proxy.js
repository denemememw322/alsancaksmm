export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const { url } = req.query;

        if (!url) {
            return res.status(400).json({ error: 'URL gerekli' });
        }

        // Body'yi al
        let body = null;
        if (req.method === 'POST' && req.body) {
            body = req.body;
        }

        const response = await fetch(url, {
            method: req.method || 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: body ? JSON.stringify(body) : undefined,
        });

        const data = await response.json();
        return res.status(200).json(data);

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
