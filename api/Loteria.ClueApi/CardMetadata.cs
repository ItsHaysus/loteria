using System.Text.Json;

namespace Loteria.ClueApi;

public sealed record CardMetadata(int Id, string File, string Name, string BuiltInClue);

public sealed class CardCatalog
{
    private readonly IReadOnlyDictionary<int, CardMetadata> cards;

    public CardCatalog()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "Data", "card-metadata.json");
        var json = File.ReadAllText(path);
        var loaded = JsonSerializer.Deserialize<List<CardMetadata>>(json, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
        }) ?? throw new InvalidOperationException("Card metadata is empty.");

        foreach (var card in loaded)
        {
            var validation = ClueValidator.Validate(card.BuiltInClue, card.Name);
            if (!validation.IsValid)
            {
                throw new InvalidOperationException(
                    $"Built-in clue for card {card.Id} is invalid: {validation.Reason}.");
            }
        }

        cards = loaded.ToDictionary(card => card.Id);
    }

    public CardMetadata? Find(int cardId) => cards.GetValueOrDefault(cardId);
}
