using Loteria.ClueApi;
using Microsoft.Extensions.Options;

var card = new CardMetadata(10, "El Árbol.webp", "El Árbol", "Tiene raíces y ramas.");
var failures = new List<string>();

await Check("valid output", async () =>
{
    var result = await Generate("Da sombra con sus grandes ramas.");
    Expect(result.Source == "model", result);
});

await Check("card-name leak with case and accent variation", async () =>
{
    var result = await Generate("Mira EL ARBOL junto al camino.");
    Expect(result.Source == "fallback" && result.Reason == "name_revealed", result);
});

await Check("empty output", async () =>
{
    var result = await Generate(" ");
    Expect(result.Source == "fallback" && result.Reason == "empty", result);
});

await Check("oversized output", async () =>
{
    var result = await Generate(new string('x', ClueValidator.MaxLength + 1));
    Expect(result.Source == "fallback" && result.Reason == "oversized", result);
});

await Check("model timeout", async () =>
{
    var options = Options.Create(new ClueOptions { TimeoutMilliseconds = 100 });
    var service = new ClueService(new DelayedModel(), options);
    var result = await service.GenerateAsync(card);
    Expect(result.Source == "fallback" && result.Reason == "timeout", result);
});

if (failures.Count > 0)
{
    Console.Error.WriteLine($"{failures.Count} fake-model test(s) failed.");
    return 1;
}

Console.WriteLine("All 5 fake-model tests passed.");
return 0;

async Task<ClueResult> Generate(string output)
{
    var options = Options.Create(new ClueOptions());
    return await new ClueService(new StaticModel(output), options).GenerateAsync(card);
}

async Task Check(string name, Func<Task> test)
{
    try
    {
        await test();
        Console.WriteLine($"PASS: {name}");
    }
    catch (Exception exception)
    {
        failures.Add(name);
        Console.Error.WriteLine($"FAIL: {name}: {exception.Message}");
    }
}

static void Expect(bool condition, ClueResult result)
{
    if (!condition)
    {
        throw new InvalidOperationException(
            $"source={result.Source}, reason={result.Reason ?? "(none)"}, clue={result.Clue}");
    }
}

sealed class StaticModel(string output) : IClueModel
{
    public Task<string?> GenerateAsync(CardMetadata card, CancellationToken cancellationToken) =>
        Task.FromResult<string?>(output);
}

sealed class DelayedModel : IClueModel
{
    public async Task<string?> GenerateAsync(CardMetadata card, CancellationToken cancellationToken)
    {
        await Task.Delay(TimeSpan.FromSeconds(5), cancellationToken);
        return "Nunca llega.";
    }
}
