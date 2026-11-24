namespace Loteria.ClueApi;

public sealed class ClueOptions
{
    public const string SectionName = "ClueModel";

    public string Provider { get; set; } = "Fake";
    public string Model { get; set; } = "llama3.2:3b";
    public int TimeoutMilliseconds { get; set; } = 2500;
    public string OllamaBaseUrl { get; set; } = "http://127.0.0.1:11434";
    public string FakeBehavior { get; set; } = "Valid";

    public void Validate()
    {
        if (!Provider.Equals("Fake", StringComparison.OrdinalIgnoreCase)
            && !Provider.Equals("Ollama", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("ClueModel:Provider must be Fake or Ollama.");
        }

        if (string.IsNullOrWhiteSpace(Model))
        {
            throw new InvalidOperationException("ClueModel:Model is required.");
        }

        if (TimeoutMilliseconds is < 100 or > 30000)
        {
            throw new InvalidOperationException("ClueModel:TimeoutMilliseconds must be between 100 and 30000.");
        }

        if (!Uri.TryCreate(OllamaBaseUrl, UriKind.Absolute, out var uri)
            || uri.Scheme != Uri.UriSchemeHttp
            || !uri.IsLoopback)
        {
            throw new InvalidOperationException("ClueModel:OllamaBaseUrl must be an HTTP loopback address.");
        }
    }
}
