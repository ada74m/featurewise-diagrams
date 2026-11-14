using System.Reflection;
using System.Runtime.InteropServices;
using System.Text.Json;

// Reads a featurewise service's compiled assembly and writes its feature graph as JSON: every feature,
// with its family and result cases, and every link a feature's result can offer to another feature.
// It inspects the assembly's metadata without running any of its code.
//
//   dotnet run --project Extractor -- <path to the service's assembly> [--service <id>] [-o <file>]
//
// The assembly's directory must also hold its dependencies, Featurewise.dll among them, as a test or
// published project's output does.

var arguments = args.ToList();
if (arguments.Count == 0 || arguments[0].StartsWith('-'))
{
    Console.Error.WriteLine("usage: extractor <assembly> [--service <id>] [-o <file>]");
    return 1;
}

var assemblyPath = Path.GetFullPath(arguments[0]);
var serviceOption = Option("--service");
var outputOption = Option("-o");

var directory = Path.GetDirectoryName(assemblyPath)!;
var paths = Directory.GetFiles(directory, "*.dll")
    .Concat(Directory.GetFiles(RuntimeEnvironment.GetRuntimeDirectory(), "*.dll"))
    .GroupBy(Path.GetFileName)
    .Select(group => group.First());
using var context = new MetadataLoadContext(new PathAssemblyResolver(paths));
var assembly = context.LoadFromAssemblyPath(assemblyPath);
var types = assembly.GetTypes();

var graph = Graph.Read(types, serviceOption ?? ServiceId(types));
var json = JsonSerializer.Serialize(graph, new JsonSerializerOptions
{
    WriteIndented = true,
    PropertyNamingPolicy = JsonNamingPolicy.CamelCase
});

if (outputOption is null)
    Console.WriteLine(json);
else
    File.WriteAllText(outputOption, json + Environment.NewLine);
return 0;

string? Option(string name)
{
    var index = arguments.IndexOf(name);
    return index >= 0 && index + 1 < arguments.Count ? arguments[index + 1] : null;
}

// The service's id, from a Service class's constant Id, as the demos declare it, or else the assembly's name.
string ServiceId(Type[] all) =>
    all.Where(type => type.Name == "Service")
        .Select(type => type.GetField("Id")?.GetRawConstantValue() as string)
        .FirstOrDefault(id => id is not null)
    ?? assembly.GetName().Name!;
