/**
 * Worker entry point. Queue registration deliberately follows the shared domain
 * contracts; jobs will be added after pg-boss is wired in the next slice.
 */
console.info("Furniture planner worker started; no queues registered yet.");
