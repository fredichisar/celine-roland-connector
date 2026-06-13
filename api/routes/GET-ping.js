import { RouteHandler } from "gadget-server";

/**
 * Health check endpoint for monitoring.
 * @type { RouteHandler }
 */
const route = async ({ request, reply }) => {
  await reply.send({ status: "ok", timestamp: new Date().toISOString() });
};

export default route;
