using System.Diagnostics;
using Microsoft.Extensions.Options;

namespace Loteria.ClueApi;

public sealed record ClueResult(
    int CardId,
    string Clue,
    string Source,
    string? Reason,
    long LatencyMs);

public sealed class ClueService(IClueModel model, IOptions<ClueOptions> options)
{
    public async Task<ClueResult> GenerateAsync(
        CardMetadata card,
        CancellationToken requestAborted = default)
    {
        var stopwatch = Stopwatch.StartNew();
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(requestAborted);
        timeout.CancelAfter(options.Value.TimeoutMilliseconds);

        try
        {
            var output = await model.GenerateAsync(card, timeout.Token);
            var validation = ClueValidator.Validate(output, card.Name);
            return validation.IsValid
                ? new(card.Id, validation.Clue!, "model", null, stopwatch.ElapsedMilliseconds)
                : Fallback(card, validation.Reason!, stopwatch);
        }
        catch (OperationCanceledException) when (requestAborted.IsCancellationRequested)
        {
            throw;
        }
        catch (OperationCanceledException)
        {
            return Fallback(card, "timeout", stopwatch);
        }
        catch (Exception)
        {
            return Fallback(card, "model_error", stopwatch);
        }
    }

    private static ClueResult Fallback(CardMetadata card, string reason, Stopwatch stopwatch) =>
        new(card.Id, card.BuiltInClue, "fallback", reason, stopwatch.ElapsedMilliseconds);
}
