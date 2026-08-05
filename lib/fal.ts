import { fal } from "@fal-ai/client";

fal.config({ credentials: process.env.FAL_KEY });

export { fal };

// v2.6 pro = good quality, cheaper. v3 pro = newest/best, pricier.
// NOTE: v2.6/v3 take `start_image_url`; v1/v2 take `image_url`. Check the
// exact input schema on the model's fal.ai API page before switching versions.
export const KLING_MODEL = "fal-ai/kling-video/v2.6/pro/image-to-video";

// Absolute, PUBLICLY reachable base URL (fal must POST to it).
// Prod: your Vercel URL. Local dev: a tunnel (cloudflared/ngrok), NOT localhost.
export const WEBHOOK_URL = `${process.env.APP_URL}/api/fal/webhook`;
