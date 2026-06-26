type SendOperation<T> = () => Promise<T>;

const recipientQueues = new Map<string, Promise<unknown>>();

export function enqueueWhatsAppSend<T>(recipientKey: string, operation: SendOperation<T>) {
  const previous = recipientQueues.get(recipientKey) ?? Promise.resolve();

  const current = previous
    .catch(() => undefined)
    .then(operation)
    .finally(() => {
      if (recipientQueues.get(recipientKey) === current) {
        recipientQueues.delete(recipientKey);
      }
    });

  recipientQueues.set(recipientKey, current);
  return current;
}
