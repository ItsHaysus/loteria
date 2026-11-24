using Microsoft.Extensions.Options;

namespace Loteria.ClueApi;

public sealed class FakeClueModel(IOptions<ClueOptions> options) : IClueModel
{
    public async Task<string?> GenerateAsync(CardMetadata card, CancellationToken cancellationToken)
    {
        var behavior = options.Value.FakeBehavior;
        if (behavior.Equals("Timeout", StringComparison.OrdinalIgnoreCase))
        {
            await Task.Delay(options.Value.TimeoutMilliseconds + 1000, cancellationToken);
        }

        if (behavior.Equals("Error", StringComparison.OrdinalIgnoreCase))
        {
            throw new HttpRequestException("Configured fake-model error.");
        }

        return behavior.ToLowerInvariant() switch
        {
            "empty" => " ",
            "leak" => $"La respuesta es {card.Name}.",
            "oversized" => new string('x', ClueValidator.MaxLength + 1),
            _ => card.BuiltInClue,
        };
    }
}
