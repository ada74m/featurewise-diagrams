namespace Messages;

// What sends a message on its way.
public interface IMailer
{
    Task Send(Message message, CancellationToken cancellationToken);
}
