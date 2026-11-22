namespace Messages;

// Where messages are kept, from their drafts to their sending.
public interface IOutbox
{
    Task<IReadOnlyList<Message>> All(CancellationToken cancellationToken);
    Task<Message?> Find(string id, CancellationToken cancellationToken);
    Task<Message> Draft(CancellationToken cancellationToken);
    Task Save(Message message, CancellationToken cancellationToken);
}
