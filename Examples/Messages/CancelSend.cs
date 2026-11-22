using Featurewise;

namespace Messages;

// Cancels a message still waiting on the queue. Once it's gone, it's too late.
public class CancelSend(IOutbox outbox) : Command<CancelSend.Args, CancelSend.Result>
{
    public record Args(string MessageId) : Link<CancelSend, Result>;

    public abstract record Result
    {
        private Result()
        {
        }

        public record Cancelled(Messages.Args LinkToMessages) : Result;

        public record AlreadySent(Messages.Args LinkToMessages) : Result;
    }

    public override async Task<Result> Invoke(Args args, CancellationToken cancellationToken)
    {
        if (await outbox.Find(args.MessageId, cancellationToken) is not { Status: MessageStatus.Queued } message)
            return new Result.AlreadySent(new Messages.Args());

        await outbox.Save(message with { Status = MessageStatus.Cancelled }, cancellationToken);
        return new Result.Cancelled(new Messages.Args());
    }
}
