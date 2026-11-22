namespace Messages;

public enum MessageStatus { Draft, Queued, Sent, Cancelled }

public record Message(string Id, string? To, string? Body, MessageStatus Status);
