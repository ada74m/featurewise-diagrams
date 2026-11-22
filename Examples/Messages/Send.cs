using Featurewise;

namespace Messages;

// Sends a draft: or rather, queues its sending, so it can still be cancelled. Queued carries a link to
// ActuallySend, a worker, which nobody can follow: the entrypoint puts it on a queue instead.
public class Send(IOutbox outbox) : Command<Send.Args, Send.Result>
{
    public record Args(string MessageId, string? To, string? Body) : Link<Send, Result>;

    public abstract record Result
    {
        private Result()
        {
        }

        public record Queued(Message Message, ActuallySend.Args LinkToActuallySend, CancelSend.Args LinkToCancel, Messages.Args LinkToMessages) : Result;

        // Not ready to send: the draft, kept with what it has, what it still needs, and the way back to it.
        public record Incomplete(Message Draft, IReadOnlyList<string> Missing, Compose.Args LinkToCompose) : Result;

        public record NotFound(string MessageId) : Result;
    }

    public override async Task<Result> Invoke(Args args, CancellationToken cancellationToken)
    {
        if (await outbox.Find(args.MessageId, cancellationToken) is not { Status: MessageStatus.Draft } draft)
            return new Result.NotFound(args.MessageId);

        var missing = new[] { (Name: "To", Value: args.To), (Name: "Body", Value: args.Body) }
            .Where(field => string.IsNullOrWhiteSpace(field.Value))
            .Select(field => field.Name)
            .ToList();
        if (missing.Count > 0)
        {
            var kept = draft with { To = args.To, Body = args.Body };
            await outbox.Save(kept, cancellationToken);
            return new Result.Incomplete(kept, missing, new Compose.Args(kept.Id));
        }

        var queued = draft with { To = args.To, Body = args.Body, Status = MessageStatus.Queued };
        await outbox.Save(queued, cancellationToken);
        return new Result.Queued(queued, new ActuallySend.Args(queued.Id), new CancelSend.Args(queued.Id), new Messages.Args());
    }
}
