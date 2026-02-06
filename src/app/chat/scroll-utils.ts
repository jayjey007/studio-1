export const isAtBottom = (
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
  threshold: number = 100
) => Math.abs(scrollHeight - scrollTop - clientHeight) < threshold;

export const shouldAutoScroll = (isFirstFetch: boolean, wasAtBottom: boolean) =>
  isFirstFetch || wasAtBottom;
