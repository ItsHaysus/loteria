using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;

namespace Loteria.ClueApi;

public sealed class OllamaClueModel(
    IHttpClientFactory httpClientFactory,
    IOptions<ClueOptions> options) : IClueModel
{
    public async Task<string?> GenerateAsync(CardMetadata card, CancellationToken cancellationToken)
    {
        var settings = options.Value;
        var client = httpClientFactory.CreateClient(nameof(OllamaClueModel));
        client.BaseAddress = new Uri(settings.OllamaBaseUrl);

        var prompt = $"""
            Escribe exactamente una pista breve en español para una carta de Lotería.
            La carta es "{card.Name}".
            No escribas el nombre de la carta, ni una variante sin acentos, ni una explicación.
            Devuelve solamente la pista, con un máximo de 120 caracteres.
            """;

        using var response = await client.PostAsJsonAsync("/api/generate", new
        {
            model = settings.Model,
            prompt,
            stream = false,
            think = false,
            options = new
            {
                temperature = 0.4,
                num_predict = 40,
            },
        }, cancellationToken);
        response.EnsureSuccessStatusCode();

        var payload = await response.Content.ReadFromJsonAsync<OllamaResponse>(
            cancellationToken: cancellationToken);
        return payload?.Response;
    }

    private sealed record OllamaResponse(
        [property: JsonPropertyName("response")] string? Response);
}
