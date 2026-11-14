using System.Reflection;

// A service's features and the links between them, as the layout reads it.
public record Graph(string Service, IReadOnlyList<Feature> Features, IReadOnlyList<Link> Links)
{
    private const string Namespace = "Featurewise";

    public static Graph Read(IEnumerable<Type> types, string service)
    {
        var all = types.Where(type => type.FullName is not null).ToList();
        var features = all
            .Select(type => (Type: type, Family: FamilyOf(type)))
            .Where(feature => feature.Family is not null && !feature.Type.IsAbstract)
            .OrderBy(feature => feature.Type.Name, StringComparer.Ordinal)
            .ToList();

        var names = features.ToDictionary(feature => feature.Type, feature => NameOf(feature.Type));
        var links = new List<(string From, string To, string Via)>();
        var result = new List<Feature>();

        foreach (var (type, family) in features)
        {
            var resultType = FeatureBase(type)!.GetGenericArguments() is { Length: 2 } arguments ? arguments[1] : null;
            var cases = resultType is null ? [] : CasesOf(resultType, all).Select(c => c.Name).ToList();
            result.Add(new Feature(names[type], family!, cases));

            if (resultType is null)
                continue;
            foreach (var (target, via) in LinksIn(resultType, $"{type.Name}.{resultType.Name}", all, []))
            {
                if (names.TryGetValue(target, out var to))
                    links.Add((names[type], to, via));
            }
        }

        var grouped = links
            .GroupBy(link => (link.From, link.To))
            .Select(group => new Link(group.Key.From, group.Key.To, group.Select(link => link.Via).Distinct().ToList()))
            .ToList();
        return new Graph(service, result, grouped);
    }

    // "command", "query" or "worker", or null if the type isn't a feature.
    private static string? FamilyOf(Type type) =>
        FeatureBase(type)?.GetGenericTypeDefinition().FullName switch
        {
            $"{Namespace}.Command`2" => "command",
            $"{Namespace}.Query`2" => "query",
            $"{Namespace}.Worker`1" => "worker",
            _ => null
        };

    private static Type? FeatureBase(Type type)
    {
        for (var current = type.BaseType; current is not null; current = current.BaseType)
        {
            if (current.IsGenericType && current.GetGenericTypeDefinition().FullName is
                    $"{Namespace}.Command`2" or $"{Namespace}.Query`2" or $"{Namespace}.Worker`1")
                return current;
        }
        return null;
    }

    // The name a feature has in links: its [FeatureName], or else its class name.
    private static string NameOf(Type type) =>
        type.GetCustomAttributesData()
            .Where(attribute => attribute.AttributeType.FullName == $"{Namespace}.FeatureNameAttribute")
            .Select(attribute => attribute.ConstructorArguments[0].Value as string)
            .FirstOrDefault() ?? type.Name;

    // The feature a link type invokes, or null if the type isn't a link.
    private static Type? LinkTarget(Type type)
    {
        for (var current = type; current is not null; current = current.BaseType)
        {
            if (current.IsGenericType && current.GetGenericTypeDefinition().FullName == $"{Namespace}.Link`2")
                return current.GetGenericArguments()[0];
        }
        return null;
    }

    // A result's cases: the records nested in it that derive from it. A result without cases has none.
    private static IEnumerable<Type> CasesOf(Type result, IReadOnlyList<Type> all) =>
        result.IsAbstract
            ? all.Where(type => !type.IsAbstract && type.BaseType == result).OrderBy(type => type.MetadataToken)
            : [];

    // Every link a value of this type can hold, with the path to it, such as
    // ClaimItem.Result.DoesntMatchReport.LinkToClaim. It looks through result cases, the service's own
    // records, nullables, arrays and collections, and doesn't look inside a link.
    private static IEnumerable<(Type Target, string Via)> LinksIn(Type type, string path, IReadOnlyList<Type> all, HashSet<Type> visited)
    {
        if (LinkTarget(type) is { } target)
        {
            yield return (target, path);
            yield break;
        }
        if (type.IsArray)
        {
            foreach (var link in LinksIn(type.GetElementType()!, path, all, visited))
                yield return link;
            yield break;
        }
        if (type.IsGenericType && type.Namespace?.StartsWith("System") == true)
        {
            foreach (var argument in type.GetGenericArguments())
            foreach (var link in LinksIn(argument, path, all, visited))
                yield return link;
            yield break;
        }
        if (type.Namespace?.StartsWith("System") == true || type.IsPrimitive || type.IsEnum || !visited.Add(type))
            yield break;

        foreach (var resultCase in CasesOf(type, all))
        foreach (var link in LinksIn(resultCase, $"{path}.{resultCase.Name}", all, visited))
            yield return link;

        foreach (var property in type.GetProperties(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly))
        {
            if (property.Name == "EqualityContract" || property.GetIndexParameters().Length > 0)
                continue;
            foreach (var link in LinksIn(property.PropertyType, $"{path}.{property.Name}", all, visited))
                yield return link;
        }
    }
}

public record Feature(string Name, string Family, IReadOnlyList<string> Cases);

// A link from one feature to another, with every place in the first's result that can hold it.
public record Link(string From, string To, IReadOnlyList<string> Via);
