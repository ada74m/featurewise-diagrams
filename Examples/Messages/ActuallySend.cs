using Featurewise;

namespace Messages;

// Takes a queued message off the queue and sends it, unless it was cancelled while it waited.
public class ActuallySend(IOutbox outbox, IMailer mailer) : Worker<ActuallySend.Args>
{
    public record Args(string MessageId) : Link<ActuallySend, Nil>;

    public override async Task<Nil> Invoke(Args args, CancellationToken cancellationToken)
    {
        if (await outbox.Find(args.MessageId, cancellationToken) is not { Status: MessageStatus.Queued } message)
            return Nil.Value;

        await mailer.Send(message, cancellationToken);
        await outbox.Save(message with { Status = MessageStatus.Sent }, cancellationToken);
        return Nil.Value;
    }
}
