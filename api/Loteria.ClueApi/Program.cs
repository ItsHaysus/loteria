using Loteria.ClueApi;
using Microsoft.Extensions.Options;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOptions<ClueOptions>()
    .Bind(builder.Configuration.GetSection(ClueOptions.SectionName))
    .Validate(options =>
    {
        options.Validate();
        return true;
    })
    .ValidateOnStart();
builder.Services.AddSingleton<CardCatalog>();
builder.Services.AddHttpClient(nameof(OllamaClueModel), client =>
{
    client.Timeout = Timeout.InfiniteTimeSpan;
});
builder.Services.AddSingleton<IClueModel>(services =>
{
    var options = services.GetRequiredService<IOptions<ClueOptions>>().Value;
    return options.Provider.Equals("Ollama", StringComparison.OrdinalIgnoreCase)
        ? ActivatorUtilities.CreateInstance<OllamaClueModel>(services)
        : ActivatorUtilities.CreateInstance<FakeClueModel>(services);
});
builder.Services.AddSingleton<ClueService>();
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.SetIsOriginAllowed(origin =>
        {
            if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri))
            {
                return false;
            }

            return uri.IsLoopback && uri.Scheme is "http" or "https";
        });
        policy.AllowAnyHeader();
        policy.AllowAnyMethod();
    });
});

var app = builder.Build();
app.UseCors();

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
app.MapGet("/api/clues/{cardId:int}", async (
    int cardId,
    CardCatalog catalog,
    ClueService clues,
    CancellationToken cancellationToken) =>
{
    var card = catalog.Find(cardId);
    if (card is null)
    {
        return Results.NotFound(new { error = "unknown_card_id" });
    }

    return Results.Ok(await clues.GenerateAsync(card, cancellationToken));
});

app.Run();

public partial class Program;
