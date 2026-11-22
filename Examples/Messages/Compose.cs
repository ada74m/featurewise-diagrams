using Featurewise;

namespace Messages;

// Starts a message, or picks up a draft that isn't finished: the draft, and the link to send it once it's
// written.
public class Compose(IOutbox outbox) : Command<Compose.Args, Compose.Result>
{
    public record Args(string? MessageId = null) : Link<Compose, Result>;

    public record Result(Message Draft, Send.Args LinkToSend);

    public override async Task<Result> Invoke(Args args, CancellationToken cancellationToken)
    {
        var draft = args.MessageId is { } id && await outbox.Find(id, cancellationToken) is { Status: MessageStatus.Draft } existing
            ? existing
            : await outbox.Draft(cancellationToken);
        return new Result(draft, new Send.Args(draft.Id, draft.To, draft.Body));
    }
}
