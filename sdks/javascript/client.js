export class ToolsetClient {
  constructor(baseUrl, { token = null, apiKey = null } = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.token = token;
    this.apiKey = apiKey;
  }

  headers() {
    const h = { "content-type": "application/json" };
    if (this.token) h["authorization"] = `Bearer ${this.token}`;
    if (this.apiKey) h["x-api-key"] = this.apiKey;
    return h;
  }

  async listTools() {
    const r = await fetch(`${this.baseUrl}/v1/tools`, { headers: this.headers() });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }

  async invoke(toolName, { input, context = {}, options = {} }) {
    const r = await fetch(`${this.baseUrl}/v1/tools/${toolName}:invoke`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ input, context, options }),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }
}

