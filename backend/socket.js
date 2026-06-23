let ioInstance = null;

export function setIo(nextIo) {
  ioInstance = nextIo || null;
  return ioInstance;
}

export function getIo() {
  return ioInstance;
}

export function safeEmit(eventName, payload) {
  const io = getIo();
  if (!io) return false;
  io.emit(eventName, payload);
  return true;
}
