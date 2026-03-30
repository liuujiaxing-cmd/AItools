package toolset

import (
  "bytes"
  "encoding/json"
  "fmt"
  "net/http"
  "time"
)

type Client struct {
  BaseURL string
  Token   string
  APIKey  string
  HTTP    *http.Client
}

func New(baseURL string) *Client {
  return &Client{BaseURL: baseURL, HTTP: &http.Client{Timeout: 30 * time.Second}}
}

func (c *Client) headers() http.Header {
  h := http.Header{}
  h.Set("content-type", "application/json")
  if c.Token != "" {
    h.Set("authorization", "Bearer "+c.Token)
  }
  if c.APIKey != "" {
    h.Set("x-api-key", c.APIKey)
  }
  return h
}

func (c *Client) ListTools() (map[string]any, error) {
  req, _ := http.NewRequest("GET", c.BaseURL+"/v1/tools", nil)
  req.Header = c.headers()
  resp, err := c.HTTP.Do(req)
  if err != nil {
    return nil, err
  }
  defer resp.Body.Close()
  if resp.StatusCode >= 400 {
    return nil, fmt.Errorf("http %d", resp.StatusCode)
  }
  var out map[string]any
  if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
    return nil, err
  }
  return out, nil
}

func (c *Client) Invoke(toolName string, input map[string]any, context map[string]any, options map[string]any) (map[string]any, error) {
  payload := map[string]any{"input": input, "context": context, "options": options}
  b, _ := json.Marshal(payload)
  req, _ := http.NewRequest("POST", c.BaseURL+"/v1/tools/"+toolName+":invoke", bytes.NewReader(b))
  req.Header = c.headers()
  resp, err := c.HTTP.Do(req)
  if err != nil {
    return nil, err
  }
  defer resp.Body.Close()
  if resp.StatusCode >= 400 {
    return nil, fmt.Errorf("http %d", resp.StatusCode)
  }
  var out map[string]any
  if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
    return nil, err
  }
  return out, nil
}

