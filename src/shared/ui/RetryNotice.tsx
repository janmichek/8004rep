type Props = {
  message: string;
  onRetry: () => void;
};

export function RetryNotice({ message, onRetry }: Props) {
  return (
    <p className="notice">
      {message}{' '}
      <button type="button" onClick={onRetry}>
        Retry
      </button>
    </p>
  );
}
