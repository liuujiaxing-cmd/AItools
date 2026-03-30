package toolset;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

public class ToolsetClient {
  private final String baseUrl;
  private final HttpClient http;
  private String token;
  private String apiKey;

  public ToolsetClient(String baseUrl) {
    this.baseUrl = baseUrl.replaceAll("/+$", "");
    this.http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
  }

  public ToolsetClient withToken(String token) {
    this.token = token;
    return this;
  }

  public ToolsetClient withApiKey(String apiKey) {
    this.apiKey = apiKey;
    return this;
  }

  private HttpRequest.Builder baseRequest(String path) {
    HttpRequest.Builder b = HttpRequest.newBuilder().uri(URI.create(this.baseUrl + path)).timeout(Duration.ofSeconds(60));
    b.header("content-type", "application/json");
    if (this.token != null && !this.token.isEmpty()) b.header("authorization", "Bearer " + this.token);
    if (this.apiKey != null && !this.apiKey.isEmpty()) b.header("x-api-key", this.apiKey);
    return b;
  }

  public String listTools() throws IOException, InterruptedException {
    HttpRequest req = baseRequest("/v1/tools").GET().build();
    HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
    if (resp.statusCode() >= 400) throw new IOException("http " + resp.statusCode() + ": " + resp.body());
    return resp.body();
  }

  public String invoke(String toolName, String jsonBody) throws IOException, InterruptedException {
    HttpRequest req = baseRequest("/v1/tools/" + toolName + ":invoke").POST(HttpRequest.BodyPublishers.ofString(jsonBody)).build();
    HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
    if (resp.statusCode() >= 400) throw new IOException("http " + resp.statusCode() + ": " + resp.body());
    return resp.body();
  }
}

