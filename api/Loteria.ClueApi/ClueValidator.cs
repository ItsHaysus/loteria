using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace Loteria.ClueApi;

public sealed record ClueValidation(bool IsValid, string? Clue, string? Reason);

public static partial class ClueValidator
{
    public const int MaxLength = 120;

    public static ClueValidation Validate(string? output, string cardName)
    {
        var clue = Whitespace().Replace(output ?? string.Empty, " ").Trim().Trim('"');
        if (clue.Length == 0)
        {
            return new(false, null, "empty");
        }

        if (clue.Length > MaxLength)
        {
            return new(false, null, "oversized");
        }

        if (RevealsName(clue, cardName))
        {
            return new(false, null, "name_revealed");
        }

        return new(true, clue, null);
    }

    public static bool RevealsName(string clue, string cardName)
    {
        var clueWords = Normalize(clue).Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var fullName = Normalize(cardName);
        var coreName = Article().Replace(fullName, string.Empty);

        return ContainsPhrase(clueWords, fullName) || ContainsPhrase(clueWords, coreName);
    }

    private static bool ContainsPhrase(string[] clueWords, string phrase)
    {
        var phraseWords = phrase.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (phraseWords.Length == 0 || phraseWords.Length > clueWords.Length)
        {
            return false;
        }

        for (var start = 0; start <= clueWords.Length - phraseWords.Length; start++)
        {
            if (phraseWords.SequenceEqual(clueWords.Skip(start).Take(phraseWords.Length)))
            {
                return true;
            }
        }

        return false;
    }

    private static string Normalize(string value)
    {
        var decomposed = value.Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(decomposed.Length);
        foreach (var character in decomposed)
        {
            var category = CharUnicodeInfo.GetUnicodeCategory(character);
            if (category == UnicodeCategory.NonSpacingMark)
            {
                continue;
            }

            builder.Append(char.IsLetterOrDigit(character) ? char.ToLowerInvariant(character) : ' ');
        }

        return Whitespace().Replace(builder.ToString(), " ").Trim();
    }

    [GeneratedRegex(@"\s+")]
    private static partial Regex Whitespace();

    [GeneratedRegex(@"^(el|la|los|las)\s+", RegexOptions.IgnoreCase)]
    private static partial Regex Article();
}
