import { EventEmitter } from 'events';

const eventBus = new EventEmitter();

// Run listeners on the next event-loop turn so API requests never wait for
// recipient resolution or notification queue writes.
const publishEvent = (eventName, payload) => {
  setImmediate(() => eventBus.emit(eventName, payload));
};

export default eventBus;
export { publishEvent };
