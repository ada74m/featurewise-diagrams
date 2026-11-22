using Featurewise;

namespace Messages;

// Every message, each still waiting to be sent with a link to cancel it, and a link to write another.
public class Messages(IOutbox outbox) : Query<Messages.Args, Messages.Result>
{
    public record Args : Link<Messages, Result>;

    public record Entry(Message Message, CancelSend.Args? LinkToCancel);

    public record Result(IReadOnlyList<Entry> Messages, Compose.Args LinkToCompose);

    public override async Task<Result> Invoke(Args args, CancellationToken cancellationToken)
    {
        var messages = await outbox.All(cancellationToken);
        var entries = messages
            .Select(message => new Entry(message, message.Status == MessageStatus.Queued ? new CancelSend.Args(message.Id) : null))
            .ToList();
        return new Result(entries, new Compose.Args());
    }
}
