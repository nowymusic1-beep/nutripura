import { createPayment } from "../../lib/mercadopago-handlers.js";
import { adapt } from "../../lib/vercel-adapter.js";
export default adapt(createPayment);
