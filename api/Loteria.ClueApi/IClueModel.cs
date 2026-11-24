namespace Loteria.ClueApi;

public interface IClueModel
{
    Task<string?> GenerateAsync(CardMetadata card, CancellationToken cancellationToken);
}
